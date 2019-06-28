const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
const Discord = require('discord.js');

// make an announcement for a given time table
async function makeExpAnnouncementMessage(clanName = 'Sorrow Knights', numTop = 5, time = 'daily', isSplit = false) {
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
	return "```\n" + announcement + "\n```"
}

function makeAchAnnouncementMessage(skill, name, level) {
	let embed = new Discord.RichEmbed()
							.setTitle(`${name.toLocaleString()} has achieved level ${level} in ${skill.toLowerCase()}!`)
							.setThumbnail(resources.skillingIcons[skill.toLowerCase()])
							.setColor(level > 99 ? 0xffe900 : 0x00AE86);
	return embed;
}

module.exports = {
	makeExpAnnouncementMessage,
	makeAchAnnouncementMessage
}