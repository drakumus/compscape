const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
const Discord = require('discord.js');
const fs = require('fs');
//require('./GraphicSpecs/rankBar.json');
var rankConfig = require('./GraphicSpecs/rankPie.json');
var epeenConfig = require('./GraphicSpecs/epeenPie.json');
var vega = require('vega');
const resources = JSON.parse(fs.readFileSync("./View/resources.json", {encoding: 'utf8'}));

// make an announcement for a given time table
async function makeExpAnnouncementMessage(clanName = 'Sorrow Knights', numTop = 5, time = 'daily', isSplit = false, isActiveEvent = false) {
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
				total = await clan.calculateTopExpEvent(clanName, numTop, "all", true, isActiveEvent);
			else {
				combat = await clan.calculateTopExpEvent(clanName, numTop, "combat", true, isActiveEvent);
				skilling = await clan.calculateTopExpEvent(clanName, numTop, "skilling", true, isActiveEvent);
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
	return "```\n" + announcement + "\n```"
}

async function makeRankAnnouncementMessage(clanName = 'Sorrow Knights', numTop = 5, time = 'daily', isSplit = false) {
	let total;
	switch(time) {
		case "daily":
			total = await clan.calculateTopExpDaily(clanName, numTop);
			break;
		case "weekly":
			total = await clan.calculateTopExpWeekly(clanName, numTop);
			break;
		case "monthly":
			total = await clan.calculateTopExpMonthly(clanName, numTop);
			break;
		case "event":
			total = await clan.calculateTopExpEvent(clanName, numTop);
			break;
	}
	if(total[0].name == undefined) {
		return false;
	}
	//let total = await clan.calculateTopExpDaily(clanName, numTop);
	let data = [];
	for(let i in total) {
		//data.push({"x": total[i].name, "y": total[i].exp, "c":0})
		data.push({"id": total[i].name, "field": parseInt((total[i].exp/1000), 10)})
	}
	rankConfig.data[0].values = data;
	var view = new vega
    .View(vega.parse(rankConfig))
    .renderer('none')
    .initialize();

    // generate static PNG file from chart
    let canvas = await view.toCanvas()
	// process node-canvas instance for example, generate a PNG stream to write var
	const stream = canvas.createPNGStream();
	const out = fs.createWriteStream(__dirname + '/rank.png');
	console.log('Writing PNG to file...');
	stream.pipe(out);
	let result = await new Promise((res, rej) => {
		try {
			out.on('finish', () => {res(true)});
		} catch {
			rej(false);
		}
	});
	return result;
}

async function makeEpeenAnnouncementMessage(user, clanName = 'Sorrow Knights') {
	let data = await clan.calculateClanAllTimedUserRank(user, clanName, "all");
	// put data in format useable by chart
	// don't forget to subtract user exp from clan exp for pie chart!
	// total exp
	epeenConfig.data[0].values = [{"id": "Your Exp", "field": parseInt(data.total.userTotal/1000,10)},
								  {"id": "Clan Exp", "field": parseInt((data.total.clanTotal - data.total.userTotal)/1000, 10)}];
	// daily exp
	epeenConfig.data[1].values = [{"id": "Your Exp", "field": parseInt(data.daily.userTotal/1000,10)},
								  {"id": "Clan Exp", "field": parseInt((data.daily.clanTotal - data.daily.userTotal)/1000, 10)}];
	// weekly exp
	epeenConfig.data[2].values = [{"id": "Your Exp", "field": parseInt(data.weekly.userTotal/1000,10)},
								  {"id": "Clan Exp", "field": parseInt((data.weekly.clanTotal - data.weekly.userTotal)/1000, 10)}];
	// monthly exp
	epeenConfig.data[3].values = [{"id": "Your Exp", "field": parseInt(data.monthly.userTotal/1000,10)},
								  {"id": "Clan Exp", "field": parseInt((data.monthly.clanTotal - data.monthly.userTotal)/1000, 10)}];
	var view = new vega
	.View(vega.parse(epeenConfig))
	.renderer('none')
	.initialize();

	// generate static PNG file from chart
	let canvas = await view.toCanvas()
	// process node-canvas instance for example, generate a PNG stream to write var
	const stream = canvas.createPNGStream();
	const out = fs.createWriteStream(__dirname + '/epeen.png');
	console.log('Writing PNG to file...');
	stream.pipe(out);
	let result = await new Promise((res, rej) => {
		try {
			out.on('finish', () => {res(true)});
		} catch {
			rej(false);
		}
	});
	return !result? false: data;
}

function makeAchAnnouncementMessage(skill, name, level) {
	let embed = new Discord.RichEmbed()
							.setTitle(`${name.toLocaleString()} has achieved level ${level} in ${skill.toLowerCase()}!`)
							.setThumbnail(resources.skillingIcons[skill.toLowerCase()])
							.setColor(level > 99 ? 0xffe900 : 0x00AE86);
	return embed;
}

function makeMaxAnnouncementMessage(name)
{
	let embed = new Discord.RichEmbed()
							.setTitle(`${name.toLocaleString()} has achieved at least level 99 in all skills!`)
							.setThumbnail(resources.skillingIcons["Max Cape"])
							.setColor(0x03fcfc)
							.setImage("https://i.imgur.com/s9bPVaK.gif");
	return embed;
}

module.exports = {
	makeExpAnnouncementMessage,
	makeAchAnnouncementMessage,
	makeRankAnnouncementMessage,
	makeEpeenAnnouncementMessage,
	makeMaxAnnouncementMessage
}