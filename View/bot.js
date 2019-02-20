const Discord = require('discord.js');
const max = require('../Model/max.js');
const db = require('../Model/database.js');
var clan = require('../Model/clan.js');
var schedule = require('node-schedule');
var scraper = require('../Model/scraper')
var table = require('table').table;
var fs = require('fs');

// a quick discussion on webhooks and how they're used with discord:
// It is not possible for a bot to do anything but respond to events in discord.
// To push updates to a discord channel you need to use a webhook.
// Hence the use of one here to push daily, weekly, and monthly updates
const secret = JSON.parse(fs.readFileSync("./View/secret.json", { encoding: 'utf8' }));
const hook = new Discord.WebhookClient(secret.hook_id,secret.hook_token);

const client = new Discord.Client();

function checkForInjection(message) {
	return message.indexOf(';') == -1 ? false : true;
}

// make an announcement for a given time table
async function makeExpAnnouncement(clanName = 'Sorrow Knights', numTop = 5, time = 'daily', isSplit = false) {
	var announcement = `top gains are:`;
	//await clan.updateClan('Sorrow Knights');
	var total, combat, skilling;
	switch(time) {
		case 'daily':
			announcement = "Today's " + announcement;
			if(!isSplit)
				total = await clan.calculateTopExpDaily(clanName, numTop);
			else {
				combat = await clan.calculateTopExpDaily(clanName, numTop, "combat");
				skilling = await clan.calculateTopExpDaily(clanName, numTop, "skilling");
			}
			break;
		case 'weekly':
			announcement = "This week's " + announcement;
			if(!isSplit)
				total = await clan.calculateTopExpWeekly(clanName, numTop);
			else {
				combat = await clan.calculateTopExpWeekly(clanName, numTop, "combat");
				skilling = await clan.calculateTopExpWeekly(clanName, numTop, "skilling");
			}
			break;
		case 'monthly':
			announcement = "This month's " + announcement;
			if(!isSplit)
				total = await clan.calculateTopExpMonthly(clanName, numTop);
			else {
				combat = await clan.calculateTopExpMonthly(clanName, numTop, "combat");
				skilling = await clan.calculateTopExpMonthly(clanName, numTop, "skilling");
			}
			break;
		case 'event':
			announcement = "This event's " + announcement;
			if(!isSplit)
				total = await clan.calculateTopExpEvent(clanName, numTop);
			else {
				combat = await clan.calculateTopExpEvent(clanName, numTop, "combat");
				skilling = await clan.calculateTopExpEvent(clanName, numTop, "skilling");
			}
			break;

	}
	if(!isSplit) {
		for(var i = 0; i < numTop; i++) {
			if(typeof total[i].name != 'undefined')
				announcement += `\n${i+1}) ${total[i].name} at ${total[i].exp.toLocaleString()}` + " exp.";
		}
	}
	else {
		announcement += "\n***COMBAT***"
		for(var i = 0; i < numTop; i++) {
			if(typeof combat[i].name != 'undefined')
				announcement += `\n${i+1}) ${combat[i].name} at ${combat[i].exp.toLocaleString()}` + " exp.";
		}
		announcement += "\n***SKILLING***"
		for(var i = 0; i < numTop; i++) {
			if(typeof skilling[i].name != 'undefined')
				announcement += `\n${i+1}) ${skilling[i].name} at ${skilling[i].exp.toLocaleString()}` + " exp.";
		}
	}
	hook.send("```\n" + announcement + "\n```"); // have the hook send the announcement
}

// every hour on the 30min mark
var daily_update = schedule.scheduleJob('30 * * * *', function(){
	clan.updateClan('Sorrow Knights');
})

// at 0 gmt
var daily_job = schedule.scheduleJob('0 0 * * *', function(){
	// calculate the last days top exp and send to discord channel
	var numTop = 10;

	//hook.send("----------" + n + "----------");
	makeExpAnnouncement('Sorrow Knights',numTop, 'daily').then(res => {
		clan.setDailyXP();
	});
	// send stuff to discord channel
});

// at 0 gmt every Wed update weekly
var weekly_job = schedule.scheduleJob('0 0 * * 1', function(){
	// calculate the last week's top exp and send to discord channel
	var numTop = 5;
	makeExpAnnouncement('Sorrow Knights', 5, 'weekly').then (res => {
		clan.setWeeklyXp();
	});
	// send stuff to discord channel
});

// at 0 gmt every first day of the month update monthly
var monthly_job = schedule.scheduleJob('0 0 1 * *', function(){
	// calculate the last month's top exp and send to discord channel
	makeExpAnnouncement('Sorrow Knights', 5, 'monthly').then (res => {
		clan.setMonthlyXp();
	});
	// send stuff to discord channel
});

var prif_job = schedule.scheduleJob('1 * * * *', function(){
	scraper.getHour().then(res => {
		hook.send("The Voice of Seren is now active in " + res);
	})
})

client.on('ready', () => {
  console.log(`${client.user.tag} is up and running!`);
});

client.on('message', msg => {
  if (msg.content[0] === '!') {
    var args = msg.content.split(" ");
    var command = args[0];
	if(checkForInjection(msg.content)) { // have to sanitize my inputs
		msg.reply("Fuck you.");			 // wouldn't want an injection attack now would we :)
	} else if(command === '!max') {
		// check to make sure a username was provided
		if(args.length >= 2) {
			// concatenate the username args
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}
				// get the character data from runemetric api endpoint and calc exp to max.
				max.calcExpToMax(name).then(function(exp) {
					msg.channel.send(name + ' has ' + exp.toLocaleString() + ' exp left to max.');
				}).catch( rej => {
					msg.channel.send('Invalid username.');
				});
		} else {
			msg.reply('Please provide the username you wish to check.');
		}
    } else if(command === '!daily') {
		// gives the current top X players for the daily time table
		clanChannel = msg.channel;
		makeExpAnnouncement('Sorrow Knights', 5, 'daily');
	} else if(command === '!weekly') {
		// gives the current top X players for the weekly time table
		clanChannel = msg.channel;
		makeExpAnnouncement('Sorrow Knights', 5, 'weekly');
	} else if(command === '!monthly') {
		// gives the current top X players for the monthly time table
		clanChannel = msg.channel;
		makeExpAnnouncement('Sorrow Knights', 5, 'monthly');
	} else if(command === '!exp' || command === '!Exp') {
		if(args.length >= 2) {
			// concatenate the username args
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}
			clan.getUserTable(name).then(res => {
				var config = {
					drawHorizontalLine: (index, size) => {
						return index === 0 || index === 1 || index === size;
					},
					columns: {
						0: {
							alignment: 'left',
							minWidth: 5
						},
						1: {
							alignment: 'right',
							minWidth: 5
						},
						2: {
							alignment: 'right',
							minWidth: 5
						},
						3: {
							alignment: 'right',
							minWidth: 5
						}
					}
				};
				var t = table(res, config);
				msg.channel.send('```\n'+ t + '\n```');
			}).catch( rej => {
				msg.channel.send('Invalid username.');
			});
		} else {
			msg.reply('Please provide the username you wish to check.');
		}
	} else if(command === "!canjoin") {
		// concatenate the username args
		if(args.length >= 2) {
			// concatenate the username args
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}
			max.canTheyJoinTheClan(name).then(res => {
				if(res) {
					msg.channel.send(name + " is eligible to join the clan!");
				} else {
					msg.channel.send("Unfortunately, " + name + " does not meet the minimum requirements to join the clan.");
				}
				max.getHiscoreTable(name).then(res => {
					var config = {
						drawHorizontalLine: (index, size) => {
							return index === 0 || index === 1 || index === size;
						},
						columns: {
							0: {
								alignment: 'left',
								minWidth: 5
							},
							1: {
								alignment: 'right',
								minWidth: 5
							},
							2: {
								alignment: 'right',
								minWidth: 5
							}
						}
					};
					var t = table(res, config);
					msg.channel.send('```\n' + t + '\n```');
				})
			})//.catch( rej => {
			//	console.log(rej);
			//	msg.channel.send('Invalid username.');
			//});
		} else {
			msg.reply('Please provide the username you wish to check.');
		}
	} else if (command.toUpperCase() === '!clanexp'.toUpperCase()) {
		if(args.length >= 2) {
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}

			clan.getClanExp(name).then(res => {
				if(res.length > 0) {
					msg.channel.send(name+" has gained a total of " + parseInt(res, 10).toLocaleString() + " exp since joining the clan.");
				}
			}).catch(err => {
				msg.channel.send("Failed to find user data. Are they in the clan?")
			});
		} else {
			msg.reply('Please provide the username you wish to check.');
		}
	} else if (command.toUpperCase() === '!rank'.toUpperCase()) {
		if(args.length >= 2) {
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}

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
		} else {
			msg.reply('Please provide the username you wish to check.');
		}
	} else if (command.toUpperCase() === '!leaderboard'.toUpperCase()) {
		makeExpAnnouncement('Sorrow Knights', 5, 'event', true);
	} else if (command.toUpperCase() === '!log'.toUpperCase()) {
		if(args.length >= 2) {
			var name = "";
			for(var i = 1; i < args.length; i++) {
				name += args[i];
				if(i != args.length-1) name += " ";
			}

			max.getALog(name).then(res => {
				var image_url = `http://secure.runescape.com/m=avatar-rs/${name}/chat.png`;
				let embed = new Discord.RichEmbed()
				.setTitle(`${name}'s Adventure Log`)
				.setThumbnail(image_url)
				.setColor(0xe500ff);

				for (var i in res) {
					let val = res[i];
					embed.addField(val.date, val.details, false);
				}

				msg.channel.send({embed});
			}).catch(err => {
				msg.channel.send("User's profile is either private or username is invalid.")
			});
		}
	}
  }
});

client.login(secret.token);
//makeExpAnnouncement('Sorrow Knights', 5, 'daily');
//makeExpAnnouncement('Sorrow Knights', 5, 'monthly');