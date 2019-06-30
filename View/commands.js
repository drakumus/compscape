const max = require('../Model/max.js');
var clan = require('../Model/clan.js');
const annmsg = require('./announcementmsg.js');
var table = require('table').table;

function normalizeCommand(command = "") {
    return command.toLowerCase().substr(1);
}

async function handleMax(name) {
    try {
        let exptomax = await max.calcExpToMax(name)
        return name + ' has ' + exptomax.toLocaleString() + ' exp left to max.';
    } catch {
        return 'Invalid username.';
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
        return 'Please provide the username you wish to check.';
    }
}

async function handleCanJoin(name) {
    let text = "";
    if (name == null) {
        return 'Please provide the username you wish to check.';
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
        return 'Invalid username.';
    };
}

async function handleClanExp(name) {
    if(name == null) {
        return 'Please provide the username you wish to check.';
    }
    try {
        let res = await clan.getClanExp(name)
        if(res.length > 0) {
            return name + " has gained a total of " + parseInt(res, 10).toLocaleString() + " exp since joining the clan.";
        }
    } catch {
        return "Failed to find user data. Are they in the clan?"
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
    let epeenLength = Math.round((1-percentile) * 10);
    let epeen = "**3"
    for(let i = 0; i < epeenLength; i++) {
        epeen += "="
    }
    epeen += "D**";
    return epeen;
}

async function handleEPeen(name) {
    let data = await annmsg.makeEpeenAnnouncementMessage(name);
    if(!data){
        return "This epeen cannot be measured."
    }
    let message = ""
    // DAILY
    message += "***:regional_indicator_d: :regional_indicator_a: :regional_indicator_i: :regional_indicator_l: :regional_indicator_y:***\n"
    message += `**Rank:**           ${data.daily.userRank}\n`;
    message += `**Percentile:** ${(data.daily.userPercentile*100).toFixed(2)}%\n`;
    message += `**Epeen:**         ${makeEpeen(data.daily.userPercentile)}\n`;
    // WEEKLY
    message += ":regional_indicator_w::regional_indicator_e::regional_indicator_e::regional_indicator_k::regional_indicator_l::regional_indicator_y:\n"
    message += `**Rank:**           ${data.weekly.userRank}\n`;
    message += `**Percentile:** ${(data.weekly.userPercentile*100).toFixed(2)}%\n`;
    message += `**Epeen:**         ${makeEpeen(data.weekly.userPercentile)}\n`;
    // MONTHLY
    message += ":regional_indicator_m::regional_indicator_o::regional_indicator_n::regional_indicator_t::regional_indicator_h::regional_indicator_l::regional_indicator_y:\n"
    message += `**Rank:**           ${data.monthly.userRank}\n`;
    message += `**Percentile:** ${(data.monthly.userPercentile*100).toFixed(2)}%\n`;
    message += `**Epeen:**         ${makeEpeen(data.monthly.userPercentile)}\n`;
    // TOTAL
    message += ":regional_indicator_t::regional_indicator_o::regional_indicator_t::regional_indicator_a::regional_indicator_l:\n"
    message += `**Rank:**           ${data.total.userRank}\n`;
    message += `**Percentile:** ${(data.total.userPercentile*100).toFixed(2)}%\n`;
    message += `**Epeen:**         ${makeEpeen(data.total.userPercentile)}\n`;
    message += "Below you can see how your exp shapes up against the rest of the clan's!"
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
        return await handleEPeen(name);
    }
}

module.exports = {
    handleResponse
}