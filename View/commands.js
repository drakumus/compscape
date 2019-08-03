const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
const annmsg = require('./announcementmsg.js');
var table = require('table').table;

const INVALID_USERNAME = "The username you tried to use could not be found. Use *!myrsn YOUR NAME* to set your username to use commands without a name."

function normalizeCommand(command = "") {
    return command.toLowerCase().substr(1);
}

async function handleMax(name) {
    try {
        let exptomax = await max.calcExpToMax(name)
        return name + ' has ' + exptomax.toLocaleString() + ' exp left to max.';
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
    thresh = thresh * 1000000;
    let message = ``;
    let count = 1;
    for (i in timedTotal) {
        if(timedTotal[i] > thresh) {
            message += `${count}. ${i}\n`
            count++;
        }
    }

    return message;
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
    console.log(message);
    return {message: message, files: ["./View/epeen.png"]}
}

async function handleResponse(args, command, name, id, ach_hook_callback) {
    command = normalizeCommand(command);
    if        (command === 'max') {
        return await handleMax(name);
    } else if (command === 'daily'  || 
               command === 'weekly' ||
               command === 'monthly') {
        return await handleTimeRank(command);
    } else if (command === 'exp') {
        return await handleExp(name, ach_hook_callback);
    } else if (command === 'canjoin') {
        return await handleCanJoin(name);
    } else if (command === 'clanexp') {
        return await handleClanExp(name);
    } else if (command === 'myrsn') {
        return await handleMyRSN(name, id);
    } else if (command === 'gdaily'  || 
               command === 'gweekly' ||
               command === 'gmonthly') {
        if(args.length > 1) {
            if(!isNaN(args[1]))
                return await handleGTime(command.substr(1), parseInt(args[1]));
        }
        return await handleGTime(command.substr(1))
    } else if (command === 'epeen') {
        return await handleEPeen(name, ach_hook_callback);
    } else if (command === '7mil') {
        return await handleThresh(7, "weekly");
    }
}

module.exports = {
    handleResponse,
    handleThresh
}