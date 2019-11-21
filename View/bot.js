const Discord = require('discord.js');
const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
var schedule = require('node-schedule');
var scraper = require('../Model/scraper');
var table = require('table').table;
var commands = require('./commands.js');
var annmsg = require('./announcementmsg.js');
var validator = require('validator');
var fs = require('fs');


// a quick discussion on webhooks and how they're used with discord:
// It is not possible for a bot to do anything but respond to events in discord.
// To push updates to a discord channel you need to use a webhook.
// Hence the use of one here to push daily, weekly, and monthly updates
const secret = JSON.parse(fs.readFileSync("./View/secret.json", { encoding: 'utf8' }));
const spam_hook = new Discord.WebhookClient(secret.spam_hook_id,secret.spam_hook_token);
const ach_hook = new Discord.WebhookClient(secret.ach_hook_id, secret.ach_hook_token);
const client = new Discord.Client();
var isActiveEvent = false;

function checkForInjection(message) {
	//return  !(validator.isAlphanumeric(message.replace(/\s/g, '')));
	return message.indexOf(';') == -1 ? false : true;
}

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

// make an announcement for a given time table
async function makeExpAnnouncement(clanName = 'Sorrow Knights', numTop = 5, time = 'daily', isSplit = false, isSpam = true) {
	if(numTop > 15) {
        numTop = 15;
	}
	if(time == "weekly") {
		await sleep(10000);
	} else if (time == "monthly")
	{
		await sleep(30000);
	}
    let canDo = await annmsg.makeRankAnnouncementMessage('Sorrow Knights', numTop, time, false);
    if(canDo) {
        if(isSpam) {
			spam_hook.send({files: ["./View/rank.png"]});
		} else {
			ach_hook.send({files: ["./View/rank.png"]});
		}	
    } else {
		if(isSpam) {
			spam_hook.send("Not enough data to make announcement.");
		} else {
			ach_hook.send("Not enough data to make announcement.");
		}
	}
	return canDo;
}

// expects 
/*
{
	'Z0CI':
	{
		99s:
		{
			[0]: "Strength",
			[1]: "Smithing"
		}
		120s: {}
	}
	
}
*/

async function makeUserSkillAchievementAnnouncement(new99sAnd120s) {
	// limit per message is 10
	
	let embeds = [];
	for(name in new99sAnd120s){
		if(new99sAnd120s[name]['isNewMax'] == true)
		{
			embeds.push(annmsg.makeMaxAnnouncementMessage(name));
		}
		for(let skill in new99sAnd120s[name]['99s']){
			let skillName = new99sAnd120s[name]['99s'][skill];
			embeds.push(annmsg.makeAchAnnouncementMessage(skillName, name, 99));
		}
		for(let skill in new99sAnd120s[name]['120s']){
			let skillName = new99sAnd120s[name]['120s'][skill];
			embeds.push(annmsg.makeAchAnnouncementMessage(skillName, name, 120));
		}
	}

	// send off the message
	let tenSet = [];
	let achieves = {};
	for(var i = 0; i < embeds.length; i++)
	{
		tenSet.push(embeds[i]);
		if((i+1)%10 == 0 && i != 0)
		{
			achieves.embeds = tenSet;
			ach_hook.send(achieves);
			await sleep(1000); // need to wait for hook to actually send
			tenSet = [];
		}
	}
	if(embeds.length%10 != 0)
	{
		achieves.embeds = tenSet;
		ach_hook.send(achieves);
	}
}

// every hour on the 30min mark
var hourly_update = schedule.scheduleJob('30 * * * *', function(){
	new Promise(() => {
		clan.updateClan('Sorrow Knights').then((new99sAnd120s) =>{
			makeUserSkillAchievementAnnouncement(new99sAnd120s);
		});
	});
});

// at 0 gmt
var before_reset_job = schedule.scheduleJob('59 23 * * 7', function() {
	commands.handleThresh(7, "weekly").then (res => {
		if(typeof res != "undefined")
		{
			res.embeds = [];
			res.embeds[0] = res.embed;
			spam_hook.send(res);
		}
	});
});

var daily_job = schedule.scheduleJob('0 0 * * *', function(){
	// calculate the last days top exp and send to discord channel
	var numTop = 10;

	//hook.send("----------" + n + "----------");
	makeExpAnnouncement('Sorrow Knights', 10, 'daily', false, false).then(res => {
		clan.setDailyXP();
	});

	commands.handleThresh().then (res => {
		if(typeof res != "undefined")
		{
			res.embeds = [];
			res.embeds[0] = res.embed;
			spam_hook.send(res);
		}
	})
	// send stuff to discord channel
});

// at 0 gmt every Wed update weekly
var weekly_job = schedule.scheduleJob('0 0 * * 1', function(){
	// calculate the last week's top exp and send to discord channel
	var numTop = 5;
	makeExpAnnouncement('Sorrow Knights', 10, 'weekly', false, false).then (res => {
		clan.setWeeklyXp();
	});
	// send stuff to discord channel
});

// at 0 gmt every first day of the month update monthly
var monthly_job = schedule.scheduleJob('0 0 1 * *', function(){
	// calculate the last month's top exp and send to discord channel
	makeExpAnnouncement('Sorrow Knights', 10, 'monthly', false, false).then (res => {
		clan.setMonthlyXp();
	});
	// send stuff to discord channel
});

var prif_job = schedule.scheduleJob('1 * * * *', function(){
	scraper.getHour().then(res => {
		spam_hook.send("The Voice of Seren is now active in " + res);
	})
})

async function getName(args, id) {
	var name = null;
	if(args.length >= 2) {
		// concatenate the username args
		name = "";
		for(var i = 1; i < args.length; i++) {
			name += args[i];
			if(i != args.length-1) name += " ";
		}
	} else {
		name = await clan.getUserRSN(id)
	}

	return name;
}

client.on('ready', () => {
  console.log(`${client.user.tag} is up and running!`);
});

client.on('message', msg => {
if (msg.content[0] === '!') {
    var args = msg.content.split(" ");
    var command = args[0];
	if(checkForInjection(msg.content.substr(1))) { // have to sanitize my inputs
		msg.reply("Fuck you.");			 // wouldn't want an injection attack now would we :)
	} else if (command.toUpperCase() === '!rank'.toUpperCase()) {
		getName(args, msg.member.user.id).then(name => {
			if(name != null) {
				clan.getUserRank(name, `Sorrow Knights`, `all`, `event`, isActiveEvent).then(res => {
					if(Object.keys(res).length > 0) {
						msg.channel.send("**Total Exp:** Rank " + res.rank + " at " + res.exp.toLocaleString() + " exp.");
					} else {
						msg.channel.send("No exp gained during this event.");
					}
				}).catch(err => {
					msg.channel.send("Failed to find user data. Or no exp gained.")
				});
				/*
				clan.getUserRank(name, `Sorrow Knights`, `combat`, `event`).then(res => {
					if(Object.keys(res).length > 0) {
						msg.channel.send("**COMBAT:** Rank " + res.rank + " at " + res.exp.toLocaleString() + " exp.");
					} else {
						msg.channel.send("No combat exp gained.");
					}
				}).then( res => {
					clan.getUserRank(name, 'Sorrow Knights', 'skilling', 'event').then(res => {
						if(Object.keys(res).length > 0) {
							msg.channel.send("**SKILLING:** Rank " + res.rank + " at " + res.exp.toLocaleString() + " exp.");
						} else {
							msg.channel.send("No skilling exp gained.");
						}
					})
				}).catch(err => {
					msg.channel.send("Failed to find user data. Or no exp gained.")
				});
				*/
			} else {
				msg.reply('Please provide the username you wish to check.');
			}
		});
	} else if (command.toUpperCase() === '!ports'.toUpperCase()) {
		if(args.length > 1) {
			var timer = "";
			for(var i = 1; i < args.length; i++) {
				timer += args[i];
				if(i != args.length-1) name += " ";
			}
			try{
				const minute_reg = /(?<=:)[0-9]*/
				const hour_reg = /[0-9]*(?=:)/
				let minutes = timer.match(minute_reg)[0];
				let hours = timer.match(hour_reg)[0];
				if(minutes[0] === '0' && minutes.length > 1) {
					minutes = minutes.substring(1,minutes.length);
				}
				if(hours[0] === '0' && hours.length > 1) {
					hours = hours.substring(1,hours.length);
				}
				let time = new Date();
				time.setHours(time.getHours()+ parseInt(hours));
				time.setMinutes(time.getMinutes()+parseInt(minutes));

				schedule.scheduleJob(time, function(){
					spam_hook.send(`<@${msg.member.user.id}> one of your ships has arrived!`)
				})

				msg.channel.send("Timer successfully set to go off in " + hours + " hour(s) and " + minutes + " minute(s).")
			} catch (ex) {
				msg.channel.send("Invalid time/date please enter the time you see on your ports timer");
			}
		} else {
			msg.channel.send("Missing time argument");
		}
	} else if (command.toUpperCase() === '!startEvent'.toUpperCase() && msg.member.user.id === "135244717901348864") {
		if(args.length > 1) {
			var timer = "";
			for(var i = 1; i < args.length; i++) {
				timer += args[i];
				if(i != args.length-1) name += " ";
			}
			try{
				const minute_reg = /(?<=:)[0-9]*/
				const hour_reg = /[0-9]*(?=:)/
				let minutes = timer.match(minute_reg)[0];
				let hours = timer.match(hour_reg)[0];
				if(minutes[0] === '0' && minutes.length > 1) {
					minutes = minutes.substring(1,minutes.length);
				}
				if(hours[0] === '0' && hours.length > 1) {
					hours = hours.substring(1,hours.length);
				}
				let time = new Date();
				time.setHours(time.getHours()+ parseInt(hours));
				time.setMinutes(time.getMinutes()+parseInt(minutes));

				schedule.scheduleJob(time, function(){
					clan.setEventXp().then(()=>{
						spam_hook.send(`Exp tracking for the event has started! Use \`!rank\` and \`!leaderboard\` to check progress. Happy Gains!`);
						isActiveEvent = true;
					});
				});

				msg.channel.send("The exp table tracking double exp will reset in " + hours + " hour(s) and " + minutes + " minute(s).")
			} catch (ex) {
				msg.channel.send("Invalid time/date please enter the time you see on your ports timer");
			}
		} else {
			msg.channel.send("Missing time argument");
		}
	} else if (command.toUpperCase() === '!endEvent'.toUpperCase() && msg.member.user.id === "135244717901348864") {
		if(args.length > 1) {
			var timer = "";
			for(var i = 1; i < args.length; i++) {
				timer += args[i];
				if(i != args.length-1) name += " ";
			}
			try{
				const minute_reg = /(?<=:)[0-9]*/
				const hour_reg = /[0-9]*(?=:)/
				let minutes = timer.match(minute_reg)[0];
				let hours = timer.match(hour_reg)[0];
				if(minutes[0] === '0' && minutes.length > 1) {
					minutes = minutes.substring(1,minutes.length);
				}
				if(hours[0] === '0' && hours.length > 1) {
					hours = hours.substring(1,hours.length);
				}
				let time = new Date();
				time.setHours(time.getHours()+ parseInt(hours));
				time.setMinutes(time.getMinutes()+parseInt(minutes));

				schedule.scheduleJob(time, function(){
					clan.setEventEndXp().then(()=>{
						spam_hook.send(`Double exp is over! The final exp totals have been saved and the final leaderboard will be updated in a bit. For now it will keep updating with current xp while dev sleeps.`);
						isActiveEvent = false;
					});
				})

				msg.channel.send("The exp table tracking double exp will be finalized in " + hours + " hour(s) and " + minutes + " minute(s).")
			} catch (ex) {
				msg.channel.send("Invalid time/date please enter the time you see on your ports timer");
			}
		} else {
			msg.channel.send("Missing time argument");
		}
	} else {
		getName(args, msg.member.user.id).then(name => {
			commands.handleResponse(args, command, name, msg.member.user.id, makeUserSkillAchievementAnnouncement, isActiveEvent).then(result => {
				// consider refactoring this
				if(typeof result === 'object'){
					if (result.embed != null) // if embed
					{
						msg.channel.send(result);
					} else // if epeen
					{
						msg.channel.send(result.message, {files: result.files});
					}
				} else if (typeof result != 'undefined') { // if text message
					if (result.length > 0)
						msg.channel.send(result);
				}
			});
		});
	}
}
});

client.login(secret.token);

// makeSkillAchievementAnnouncement('Slayer','FallenWolves','99')
//makeExpAnnouncement('Sorrow Knights', 5, 'monthly');