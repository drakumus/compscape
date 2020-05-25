const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
const annmsg = require('./announcementmsg.js');
var table = require('table').table;
const Discord = require('discord.js');

const INVALID_USERNAME = "The username you tried to use could not be found. Use *!myrsn YOUR NAME* to set your username to use commands without a name."

function normalizeCommand(command = "") {
    return command.toLowerCase().substr(1);
}

async function handleMax(name) {
    try {
        let exptomax = await max.calcExpToMax(name);
        return name + ' has ' + exptomax.toLocaleString() + ' exp left to max.';
    } catch {
        return INVALID_USERNAME;
    }
}

async function handleComp(name) {
    try {
        let message = "__**" + name + "'s Exp Remaining to True Max**__\n"
        let expRemaining = await max.calcExpToComp(name);
        for( var skill in expRemaining ) 
        {   
            message += "**" + skill + ":** " + expRemaining[skill].toLocaleString() + "\n";
        }
        return message;
        //return name + ' has ' + exptocomp.toLocaleString() + ' exp left to true max.';
    } catch {
        return INVALID_USERNAME;
    }
}


async function handleTimeRank(time = 'daily') {
    try {
        return await annmsg.makeExpAnnouncementMessage('Sorrow Knights', 5, time);
    } catch {
        return "Could not make exp announcement.";
    }
}

async function handleExp(name, ach_hook_callback) {
    if(name != null) {
        try {
            let res = await clan.getUserTable(name, ach_hook_callback);
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
            return '```\n'+ t + '\n```';
        } catch {
            return('Invalid username.');
        }
    } else {
        return INVALID_USERNAME;
    }
}

async function handleCanJoin(name) {
    let text = "";
    if (name == null) {
        return INVALID_USERNAME;
    }

    try {
        let result = await max.canTheyJoinTheClan(name);
        if(result.canjoin) {
            text = name + " is eligible to join the clan!\n" +
            "**combat:**      " + result.combat.toFixed(2) + "\n" + 
            "**total level:** " + result.total;
        } else {
            text = "Unfortunately, " + name + " does not meet the minimum requirements to join the clan.\n" +
            "**combat:**      " + result.combat.toFixed(2) + "\n" + 
            "**total level:** " + result.total;
        }
        let res = await max.getHiscoreTable(name);
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
        return text + '\n' + '```\n' + t + '\n```';
    } catch {
        return INVALID_USERNAME;
    };
}

async function handleCanTheyJoin(command, raw, sendSpam) {
    let text = "";
    let response = "";
    if (raw.length <= command.length+1) {
        return "Must include names seperated by commas i.e. \`!cantheyjoin name 1, name 2, name 3\`"
    }
    let rawNames = raw.substring(command.length+2); // +2 to include ! at start and space after
    let unclean_names = rawNames.split(",");
    let names = [];
    for(let i = 0; i < unclean_names.length; i++) {
        names.push(unclean_names[i].trim());
    }

    if (names.length == 0) {
        return "Not enough names.";
    } else if (names.length > 6)
    {
        return "A maximum of 6 names can be checked."
    }

    for(var i = 0; i < names.length; i++)
    {
        let name = names[i];
        try {
            let result = await max.canTheyJoinTheClan(name);
            if(result.canjoin) {
                text = name + " is eligible to join the clan!\n" +
                "**combat:**      " + result.combat.toFixed(2) + "\n" + 
                "**total level:** " + result.total;
            } else {
                text = "Unfortunately, " + name + " does not meet the minimum requirements to join the clan.\n" +
                "**combat:**      " + result.combat.toFixed(2) + "\n" + 
                "**total level:** " + result.total;
            }
            let res = await max.getHiscoreTable(name);
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
            text = text + '\n' + '```\n' + t + '\n```';
            text += "<------------------------------------------------->\n"
            if(i == 0) { response = text; }
            else { await sendSpam(text); }
        } catch {
            response = `<------------------------------------------------->\n`;
            response += `${name} could not be found in hiscores.\n`;
            response += `<------------------------------------------------->\n`; 
            if(i == 0) { 
                response = text;
            }
            else { 
                await sendSpam(text); }
        };
    }
    return response;
}

async function handleClanExp(name) {
    if(name == null) {
        return INVALID_USERNAME;
    }
    try {
        let res = await clan.getClanExp(name)
        if(res.length > 0) {
            return name + " has gained a total of " + parseInt(res, 10).toLocaleString() + " exp since joining the clan.";
        }
    } catch {
        return "Failed to find user data. Are they in the clan? Use *!myrsn YOUR NAME* if you're trying to use this command without specifying a username."
    }
}

async function handleMyRSN(name, id) {
    if(name == null) {
        'Please provide the username you wish to check.'
    }
    //try {
        let res = await clan.setUserRSN(id, name);
        return "Your RSN is now set to " + name + ". You can now use commands such as !exp without specifying a name.";
    //} //catch {
    //    return "Failed to set runescape name. Ping Z0CI to get it fixed";
    //}
}

async function handleGTime(time, num = 10) {
    if(num > 15) {
        num = 15;
    }
    let canDo = await annmsg.makeRankAnnouncementMessage('Sorrow Knights', num, time, false);
    if(canDo) {
        return {files: ["./View/rank.png"]}
    } else {
        return "Could not make image, probably not enough data yet."
    }
}

function makeEpeen(percentile) {
    let epeenLength = Math.ceil((percentile) * 10);
    let epeen = "**3="
    for(let i = 0; i < epeenLength; i++) {
        epeen += "="
    }
    epeen += "D**";
    return epeen;
}

async function handleThresh(thresh = 7, timePeriod = "weekly") {
    let timedTotal = await clan.calculateClanTimedTotalExp('Sorrow Knights', timePeriod, "all");
    let message = `Clannies with ${thresh} million exp this ${timePeriod}\n`;
    thresh = thresh * 1000000;
    let count = 1;
    
    for (i in timedTotal) {
        if(timedTotal[i] > thresh) {
            message += `**${count})** ${i} @ ${timedTotal[i].toLocaleString()}\n`
            count++;
        }
        
    }

    /*
    let embed = new Discord.RichEmbed()
    .setTitle(`Clannies with 7 million exp this week:`)
    .setThumbnail('https://runescape.wiki/images/f/f2/Bond_detail.png?d4bdb')
    .setColor(0x34eb5b)
    .setDescription(message);
    return {embed};
    */
   return message;
}

async function handleActive( timePeriod = "weekly") {
    let timedTotal = await clan.calculateClanTimedTotalExp('Sorrow Knights', timePeriod, "all");
    thresh = 1;
    let message = ``;
    let count = 1;
    
    let names = [];

    for (i in timedTotal) {
        if(timedTotal[i] > thresh) {
            names.push(i);
        }
    }

    let winner = names[Math.floor(Math.random()*names.length)];

    
    let embed = new Discord.RichEmbed()
    .setTitle(`Winner for random active clannie:`)
    .setThumbnail('https://runescape.wiki/images/b/bc/XP_Counter_icon.png')
    .setColor(0xfbff00)
    .setDescription(winner);
    return {embed};
}

async function handleEPeen(name, ach_hook_callback) {
    let exptable = await clan.getUserTable(name, ach_hook_callback);
    if(name == null) {
        return "Please set your rsn using the `!myrsn yourname` command or provide the username you wish to check."
    }
    let data = await annmsg.makeEpeenAnnouncementMessage(name);
    if(!data){
        return "This epeen cannot be measured."
    }
    let message = ""
    // DAILY
    message += ":regional_indicator_e: :regional_indicator_p: :regional_indicator_e: :regional_indicator_e: :regional_indicator_n:      :regional_indicator_r: :regional_indicator_e: :regional_indicator_p: :regional_indicator_o: :regional_indicator_r: :regional_indicator_t:\n"
    message += `*(Epeens now rounded up thanks to our glorious leader iSlash)*\n`
    message += `-----------------------------------------`
    message += "***DAILY***\n"
    message += `**Rank:**            ${data.daily.userRank}\n`;
    message += `**Percentile:**  ${(data.daily.userPercentile*100).toFixed(2)}%\n`;
    message += `**Experience:** ${data.daily.userTotal.toLocaleString()}\n`
    message += `**Epeen:**          ${makeEpeen(data.daily.userPercentile)}\n`;
    message += `-----------------------------------------`
    // WEEKLY
    message += "***WEEKLY***\n"
    message += `**Rank:**            ${data.weekly.userRank}\n`;
    message += `**Percentile:**  ${(data.weekly.userPercentile*100).toFixed(2)}%\n`;
    message += `**Experience:** ${data.weekly.userTotal.toLocaleString()}\n`
    message += `**Epeen:**          ${makeEpeen(data.weekly.userPercentile)}\n`;
    message += `-----------------------------------------`
    // MONTHLY
    message += "***MONTHLY***\n"
    message += `**Rank:**            ${data.monthly.userRank}\n`;
    message += `**Percentile:**  ${(data.monthly.userPercentile*100).toFixed(2)}%\n`;
    message += `**Experience:** ${data.monthly.userTotal.toLocaleString()}\n`
    message += `**Epeen:**          ${makeEpeen(data.monthly.userPercentile)}\n`;
    message += `-----------------------------------------`
    // TOTAL
    message += "***TOTAL***\n"
    message += `**Rank:**            ${data.total.userRank}\n`;
    message += `**Percentile:**  ${(data.total.userPercentile*100).toFixed(2)}%\n`;
    message += `**Experience:** ${data.total.userTotal.toLocaleString()}\n`
    message += `**Epeen:**          ${makeEpeen(data.total.userPercentile)}\n`;
    message += `-----------------------------------------***YOUR EXP TOTALS VS CLAN'S!***\n`
    //message += "Below you can see how your exp shapes up against the rest of the clan's!\n"
    //console.log(message);
    return {message: message, files: ["./View/epeen.png"]}
}

async function handleLeaderboard(numTop = 5, isSplit = true, isActiveEvent) {
    return await annmsg.makeExpAnnouncementMessage('Sorrow Knights', numTop, "event", isSplit, isActiveEvent);
}

async function handleLog(name) {
    if(name == null) {
        return "Please set your rsn using the `!myrsn yourname` command or provide the username you wish to check."
    }
    let raw_alog;
    try
    {
        raw_alog = await max.getALog(name)
    } catch {
        return "User's profile is either private or username is invalid.";
    }
					
    let image_url = await max.getUserPNG(name) 
    let embed = new Discord.RichEmbed()
    .setTitle(`${name.toLocaleString()}'s Adventure Log`)
    .setThumbnail(image_url.uri.href)
    .setColor(0xe500ff);

    for (var i in raw_alog) {
        let val = raw_alog[i];
        embed.addField(val.date, val.details, false);
    }
    return {embed};
}

async function handleExpComp(skill = "fishing")
{
    let canDo = await annmsg.makeCompetitionMessage(skill);
    if(canDo) {
        return {files: ["./View/skill.png"]}
    } else {
        return "Could not make image, probably not enough data yet."
    }
}

async function handleArchLeaderboard()
{
    let msg = "**__Top Exp in Archaeology__**\n"
    let d = new Date();
    let min = (d.getMinutes()) - 40;
    if(min < 0)
    {
        min = min + 60;
    }
    msg += `Last updated: ${min} minutes ago.\nIf you think your exp is looking a bit low on the leaderboards use the !exp or !epeen command to pull in your latest exp and try the !arch command again.\n`
    let data = await clan.getFormattedTopSkillExp("archaeology", "experience", 25);
    for(let i = 0; i < data.length; i++)
    {
        msg += `${i+1})\t**${data[i].x}**\tLevel: ${max.getLevelFromExp(data[i].y)}\tExp: ${data[i].y}\n`;
    }
    return msg;
}

async function handleResponse(args, command, raw, name, id, callbacks, isActiveEvent = false) {
    command = normalizeCommand(command);
    if        (command === 'max') {
        return await handleMax(name);
    } else if (command === 'compexp' || command === 'truemax') {
        return await handleComp(name);
    } else if (command === 'daily'  || 
               command === 'weekly' ||
               command === 'monthly') {
        return await handleTimeRank(command);
    } else if (command === 'exp') {
        return await handleExp(name, callbacks.achieves);
    } else if (command === 'canjoin') {
        return await handleCanJoin(name);
    } else if (command === 'cantheyjoin') {
        return await handleCanTheyJoin(command, raw, callbacks.spam);
    } else if (command === 'clanexp') {
        return await handleClanExp(name);
    } else if (command === 'myrsn') {
        return await handleMyRSN(name, id);
    } else if (command === 'gdaily'  || 
               command === 'gweekly' ||
               command === 'gmonthly') {
        if(args.length > 0) {
            if(!isNaN(args[0]))
                return await handleGTime(command.substr(1), parseInt(args[0]));
        }
        return await handleGTime(command.substr(1))
    } else if (command === 'epeen') {
        return await handleEPeen(name, callbacks.achieves);
    } else if (command === '7mil') {
        return await handleThresh(7, "weekly");
    } else if (command === '30mil' || command === 'dxp') {
        return await handleThresh(30, "event");
    } else if (command === 'skillerz677') {
        return await handleExp('skillerz677', callbacks.achieves);
    } else if (command === 'leaderboard' || command === 'leaderboards') {
        return await handleLeaderboard(10, false, isActiveEvent);
    } else if (command === 'log')
    {
        return await handleLog(name);
    } else if (command === 'skilling')
    {
        if(args.length > 0){
            return await handleExpComp(args[0]);
        } else {
            return await handleExpComp();
        }
        
    } else if (command === 'makas' || command === 'activewinner')
    {
        return await handleActive("weekly");
    } else if (command === 'arch')
    {
        return await handleArchLeaderboard();
    }
}

module.exports = {
    handleResponse,
    handleThresh
}