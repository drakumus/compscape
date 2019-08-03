const db = require(`./database.js`);
const max = require(`./max.js`)
var rp = require('request-promise');

// handles all communicate between the bot and what the clan data management needs to do functionally.
// abstraction layer between the bot and the db itself

const clan_member_endpoint = "http://services.runescape.com/m=clan-hiscores/members_lite.ws?clanName=";


// queries the clan endpoint of the runescape db for clan members and does a bit of string parsing to clean up the response

/**
 * 
 * @param {string} clan the name of the clan you wish to get clan members for. Works for all RS3 clans.
 * The endpoint returns more than just clan members. Possibly useful information from this enpoint includes
 * XP since joining the clan, date joined, rank
 */

async function getClanData(clan) {
    const clan_member_url = clan_member_endpoint + clan;
    let options = {
        uri: clan_member_url
    };
    let res = await rp(options);
    var arr = res.split('\n');
    arr.shift();
    
    return arr;
}

async function getClanMembers(clan) {
    var arr = await getClanData(clan);
    const clan_member_url = clan_member_endpoint + clan;
    let options = {
        uri: clan_member_url
    };
    let res = await rp(options);
    var arr = res.split('\n');
    arr.shift();
    var members = []
    arr.forEach(function(element) {
        var member = element.split(',')[0];
        const oldstring = "�";
        const newstring = " ";
        while (member.indexOf(oldstring) > -1) {
            member = member.replace(oldstring, newstring);
        }
        if(member.length > 0)
            members.push(member);
    });
    //console.log(members);
    return members;
}

async function getClanUserData(clan) {
    var arr = await getClanData(clan);
    var memberData = {}
    for(var i in arr) {
        var data = arr[i].split(',');

        var name = data[0];
        const oldstring = "�";
        const newstring = " ";
        while (name.indexOf(oldstring) > -1) {
            name = name.replace(oldstring, newstring);
        }

        if(name.length > 0) {
            memberData[name.toLowerCase()] = {
                rank: data[1],
                exp: data[2],
                kills: data[3]
            }
        }
    }

    return memberData;
}

async function getClanExp(user) {
    var clanData = await getClanUserData('Sorrow Knights');

    return clanData[user.toLowerCase()].exp;
}

/**
 * Adds a caln to the user table and experience table of the db.
 * Note that this can take upwards of 10 minutes, especially for larger clans.
 * @param {string} clan clan name
 */
async function addClan(clan) {
    var members = await getClanMembers(clan);
    await db.addUsers(members, clan);
    await db.addExpUsers(members);
}

async function matchName(newMemberName, currentUserData) {
    // get the given new members alog
    // do you get the drop in your alog if u're group bossing?
    
    // check the current member's alog

    // if they have 2 matching day time events they must be the same
    // change the current member's name to that of the new member

    //    - start logging people's adventure logs
    //      - run a script that logs everyone in the clan's log
    //      - date time | name | log title | text | details
    //      - continue to log from the most recent date time in db

}

/**
 * Adds members that don't already exist in the db that are in the specified clan to the db
 * @param {String} clan clan name
 */
async function addNewMembers(clan) {
    var members = await getClanMembers(clan);
    var dbMembers = await db.getClanMembers(clan);
    var newMembers = members.filter(val => !dbMembers.includes(val));
    var goneMembers = dbMembers.filter(val => !members.includes(val));

    // comment this out in a bit
    if(goneMembers.length > 0) {
        db.removeUsers(goneMembers);
    }
    
    if(newMembers.length > 0) {
        // for future use
        //let clan_data = await db.getAllUserData();
        /*
        for(let index in newMembers) {
            matchName(newMembers[index]);
        }
        */

        await db.addUsers(newMembers, clan);
        await db.addExpUsers(newMembers);
        await db.addExpUsers(newMembers, 'daily');
        await db.addExpUsers(newMembers, 'weekly');
        await db.addExpUsers(newMembers, 'monthly');
    }
}



//addNewMembers("Sorrow Knights")
// TODO: Create function to remove members that are no longer in a specified clan in the table

/**
 * Calculates the total exp for a single row (user)
 * @param {RowData} rowdata index value of the object returned by the query that performs a left join on the user and an experience table 
 */
function calculateTotalExp(rowdata) {
    var total = 0;
    if(typeof rowdata !== "object") {
        return total;
    }
    for(var i in rowdata) {
        var data = rowdata[i];
        if(typeof data == "number" && i != 'id' && i != 'user_id') {
            total += data;
        }
    }

    return total;
}

function calculateCombatExp(rowdata) {
    let combat = ['attack', 'strength', 'defence', 'constitution', 'ranged', 'magic', 'slayer', 'prayer', 'summoning']
    var total = 0;
    if(typeof rowdata !== "object") {
        return total;
    }
    for(var i in rowdata) {
        var data = rowdata[i];
        if(typeof data === "number" && i != 'id' && i != 'user_id' && combat.indexOf(i) >= 0) {
            total += data;
        }
    }
    return total;
}

function calculateSkillingExp(rowdata) {
    let combat = ['attack', 'strength', 'defence', 'constitution', 'ranged', 'magic', 'slayer', 'prayer', 'summoning', 'invention']
    var total = 0;
    if(typeof rowdata !== "object") {
        return total;
    }
    for(var i in rowdata) {
        var data = rowdata[i];
        if(typeof data === "number" && i != 'id' && i != 'user_id' && combat.indexOf(i) < 0) {
            total += data;
        }
    }
    return total;
}

async function getUserRSN(id) {
    let raw = await db.getDiscordUser(id);
    if(raw != null && raw.length > 0) {
        let result = raw[0]
        return result.rsn;
    }
    return null;
}

async function setUserRSN(id, rsn) {
    let current_rsn = await getUserRSN(id);
    if(current_rsn == null) {
        db.addDiscordUser(id, rsn);
    } else {
        db.updateDiscordUser(id, rsn);
    }
}

function difSkills(skillData1, skillData2) {
    var result = {}
    for(var skill in skillData1) {
        result[skill] = skillData1[skill] - skillData2[skill];
    }

    return result;
}

async function getUserTable(name, ach_callback) {
    let userAch = await db.updateExpUser(name, 'experience');
    if(userAch != null) {
        ach_callback(name, userAch);
    }
    var currentExp = await db.extractSkillDataTable(name, 'experience');
    var dailyExp = await db.extractSkillDataTable(name, 'daily');
    var weeklyExp = await db.extractSkillDataTable(name, 'weekly');
    var monthlyExp = await db.extractSkillDataTable(name, 'monthly');
    var dailyExpDif = difSkills(currentExp, dailyExp);
    var weeklyExpDif = difSkills(currentExp, weeklyExp);
    var monthlyExpDif = difSkills(currentExp, monthlyExp);
    
    var currentTotal = calculateTotalExp(currentExp);
    var dailyTotal = currentTotal - calculateTotalExp(dailyExp);
    var weeklyTotal = currentTotal - calculateTotalExp(weeklyExp);
    var monthlyTotal = currentTotal - calculateTotalExp(monthlyExp);
    

    var table = [['Skill', 'Exp', 'Daily', 'Weekly']]//, 'Weekly', 'Monthly']];
    table.push(['Total Exp', currentTotal.toLocaleString(), dailyTotal.toLocaleString(), weeklyTotal.toLocaleString()]);

    for(var i in max.skill_id_lookup) {
        var skill = max.skill_id_lookup[i];
        var lowerCaseSkill = skill.toLowerCase();
        table.push([skill, currentExp[lowerCaseSkill].toLocaleString(),dailyExpDif[lowerCaseSkill].toLocaleString(), weeklyExpDif[lowerCaseSkill].toLocaleString()]);//, monthlyExpDif[skill.toLowerCase()]]);
        // if(i === "0")
        //     table.push([skill, currentExp[lowerCaseSkill],dailyExpDif[lowerCaseSkill]]);//, weeklyExpDif[skill.toLowerCase()], monthlyExpDif[skill.toLowerCase()]]);
        // else {
        //     table[1][0] += "\n" + skill;
        //     table[1][1] += "\n" + currentExp[lowerCaseSkill];
        //     table[1][2] += "\n" + dailyExpDif[lowerCaseSkill];
        // }
    }

    return table;
}

async function calculateClanTimedTotalExp(clan = "Sorrow Knights", timeSlot = "daily", catagory = "all") {
    // find and store the difference between the timed table and the current exp table
    var current_data = await db.getClanData(clan);
    var timed_data;
    switch(timeSlot) {
        case "daily":
            timed_data   = await db.getClanData(clan, 'daily');
            break;
        case "weekly":
            timed_data  = await db.getClanData(clan, 'weekly');
            break;
        case "monthly":
            timed_data = await db.getClanData(clan, 'monthly');
            break;
    }
    
    var memberTotals = [];
    memberTimedTotals= [];
    for(var i in current_data) {  // user should be in all timed tables so this works
        var name = current_data[i].name;
        var currentTotal;
        if(catagory === "all") {
            currentTotal = calculateTotalExp(current_data[i])
            timedTotal   = calculateTotalExp(timed_data[i]);
        } else if (catagory === "combat") {
            currentTotal = calculateCombatExp(current_data[i])
            timedTotal   = calculateCombatExp(timed_data[i]);
        } else if (catagory === "skilling") {
            currentTotal = calculateSkillingExp(current_data[i])
            timedTotal   = calculateSkillingExp(timed_data[i]);
        }
        if(currentTotal - timedTotal > 0) {
            memberTimedTotals[name] = currentTotal - timedTotal;
            memberTotals[name] = currentTotal;
        }
    }
    
    return memberTimedTotals;
}


async function calculateAllClanTimedTotalExp(clan = "Sorrow Knights", catagory = "all") {
    // find and store the difference between the timed table and the current exp table
    var current_data = await db.getClanData(clan);
    var timed_data = {}
    timed_data['daily']   = await db.getClanData(clan, 'daily');
    timed_data['weekly']  = await db.getClanData(clan, 'weekly');
    timed_data['monthly'] = await db.getClanData(clan, 'monthly');
    
    var memberTotals = [];
    var memberTimedTotals = {};
    memberTimedTotals['daily']   = [];
    memberTimedTotals['weekly']  = [];
    memberTimedTotals['monthly'] = [];
    for(var i in current_data) {  // user should be in all timed tables so this works
        var name = current_data[i].name;
        var currentTotal;
        if(catagory === "all") {
            currentTotal      = calculateTotalExp(current_data[i])
            timedTotalDaily   = calculateTotalExp(timed_data['daily'][i]);
            timedTotalWeekly  = calculateTotalExp(timed_data['weekly'][i]);
            timedTotalMonthly = calculateTotalExp(timed_data['monthly'][i]);
        } else if (catagory === "combat") {
            currentTotal      = calculateCombatExp(current_data[i])
            timedTotalDaily   = calculateCombatExp(timed_data['daily'][i]);
            timedTotalWeekly  = calculateCombatExp(timed_data['weekly'][i]);
            timedTotalMonthly = calculateCombatExp(timed_data['monthly'][i]);
        } else if (catagory === "skilling") {
            currentTotal      = calculateSkillingExp(current_data[i])
            timedTotalDaily   = calculateSkillingExp(timed_data['daily'][i]);
            timedTotalWeekly  = calculateSkillingExp(timed_data['weekly'][i]);
            timedTotalMonthly = calculateSkillingExp(timed_data['monthly'][i]);
        }
        if(currentTotal - timedTotalDaily > 0)
            memberTimedTotals['daily'].push(  {name: name, exp: currentTotal - timedTotalDaily});
        if(currentTotal - timedTotalWeekly > 0)
            memberTimedTotals['weekly'].push( {name: name, exp: currentTotal - timedTotalWeekly});
        if(currentTotal - timedTotalMonthly > 0)
            memberTimedTotals['monthly'].push({name: name, exp: currentTotal - timedTotalMonthly});
        memberTotals.push({name: name, exp: currentTotal});
    }
    return {"memberTotals": memberTotals, "timedTotals": memberTimedTotals};
}

function sortAndRankTotals(user, totals) {
    let clanTotal = 0;
    let userRank = 0;
    let userTotal = 0;
    let userPercentile = 1;
    if(Object.keys(totals).length == 0) {
        return {
            clanTotal: 0,
            userRank: 0,
            userPercentile: 1
        }
    }
    // [1,2,3,4,5]
    // largest = 1
    // 
    for(var i in totals) {
        var largest = i;
        for(var p = i; p < totals.length; p++) {
            if(totals[p].exp > totals[largest].exp) largest = p;
        }

        // add the largest to the clan total exp
        clanTotal += totals[largest].exp;
        // swap
        let temp = totals[i];
        totals[i] = totals[largest];
        totals[largest] = temp;
    }

    // could combine with above but I'm lazy
    for(var i in totals) {
        if(totals[i].name.toLowerCase() == user.toLowerCase()) {
            userRank = parseInt(i,10) + 1;
            userTotal = totals[i].exp;
            userPercentile = (userRank / Object.keys(totals).length);
            break;
        }
    }
    return {
        userTotal: userTotal,
        clanTotal: clanTotal,
        userRank: userRank,
        userPercentile: (1 - userPercentile)
    }
}

async function calculateClanAllTimedUserRank(user, clan = "Sorrow Knights", category="all"){
    let res = await calculateAllClanTimedTotalExp(clan, category);
    let memberTotals = res.memberTotals;
    let timedTotal = res.timedTotals;
    // calculate clan total exp while sorting
    // when user name is seen store total seperately
    // sort the list until the top x players have been found

    let totalData   = sortAndRankTotals(user, memberTotals);
    let dailyData   = sortAndRankTotals(user, timedTotal.daily);
    let weeklyData  = sortAndRankTotals(user, timedTotal.weekly);
    let monthlyData = sortAndRankTotals(user, timedTotal.monthly);
    let result = {}
    result["total"] = totalData;
    result["daily"] = dailyData;
    result["weekly"] = weeklyData;
    result["monthly"] = monthlyData;

    return result;
}

/**
 * Performs a dif on the total exp for the experience table and a given time table (daily, weekly, monthly).
 * The dif list is then sorted and the numTop users are presented.
 * @param {String} clan clan you wish to find the top exp for a given time period for
 * @param {String} timeSlot time table you wish to reference: daily, weekly, monthly
 * @param {number} numTop between 1 and # members in the clan
 */
async function calculateTopExp(clan, timeSlot, numTop, catagory = "all") {
    // find and store the difference between the timed table and the current exp table
    var current_data = timeSlot === "event" ? 
                       await  db.getClanData(clan, "end"):
                       await db.getClanData(clan);
    var timed_data = await db.getClanData(clan, timeSlot);
    var memberTotals = {}; // where the fuck did the rest go?
    for(var i in timed_data) {
        var name = timed_data[i].name;
        var currentTotal, timedTotal;
        if(catagory === "all") {
            currentTotal = calculateTotalExp(current_data[i])
            timedTotal = calculateTotalExp(timed_data[i]);
        } else if (catagory === "combat") {
            currentTotal = calculateCombatExp(current_data[i])
            timedTotal = calculateCombatExp(timed_data[i]);
        } else if (catagory === "skilling") {
            currentTotal = calculateSkillingExp(current_data[i])
            timedTotal = calculateSkillingExp(timed_data[i]);
        }
        var total = currentTotal - timedTotal;
        if(total > 0 && timedTotal > 0) memberTotals[name] = total;
    }

    // sort the list until the top x players have been found
    var top = [];
    for(var i = 0; i < numTop; i++) {
        var largest = Object.keys(memberTotals)[0];
        for(var p in memberTotals) {
            if(memberTotals[p] > memberTotals[largest]) largest = p;
        }
        top.push({name: largest, exp: memberTotals[largest]});
        delete memberTotals[largest];
    }

    return top; // formate {name: String, exp: number}
}

async function getUserRank(user, clan, catagory = "all", timeSlot) {
    //await db.updateExpUser(user);
    var current_data = timeSlot === "event" ? 
                        await  db.getClanData(clan, "end"):
                        await db.getClanData(clan);
    var timed_data = await db.getClanData(clan, timeSlot);
    var memberTotals = {};

    for(var i in timed_data) {
        var name = timed_data[i].name;
        var currentTotal, timedTotal;
        if(catagory === "all") {
            currentTotal = calculateTotalExp(current_data[i])
            timedTotal = calculateTotalExp(timed_data[i]);
        } else if (catagory === "combat") {
            currentTotal = calculateCombatExp(current_data[i])
            timedTotal = calculateCombatExp(timed_data[i]);
        } else if (catagory === "skilling") {
            currentTotal = calculateSkillingExp(current_data[i])
            timedTotal = calculateSkillingExp(timed_data[i]);
        }
        var total = currentTotal - timedTotal;
        if(total > 0 && timedTotal > 0) memberTotals[name] = total;
    }

    // sort the list
    var sorted = [];
    for(var i = 0; i < Object.keys(memberTotals).length; i++) {
        var largest = Object.keys(memberTotals)[0];
        for(var p in memberTotals) {
            if(memberTotals[p] > memberTotals[largest]) largest = p;
        }
        sorted.push({name: largest, exp: memberTotals[largest]});
        delete memberTotals[largest];
    }
    
    var rank = -1;

    for(var i in sorted) {
        if(sorted[i].name.toLowerCase() === user.toLowerCase()) {
            rank = parseInt(i, 10) + 1;
            break;
        }
    }
    let result = {}
    if(rank !== -1) result = {rank: rank, exp: sorted[rank-1].exp };
    return result;
}

// uses the calculate top method with the daily table
async function calculateTopExpDaily(clan, numTop, type = "all") {
    const result = await calculateTopExp(clan, 'daily', numTop, type);
    return result;
}

// uses the calculate top method with the weekly table
async function calculateTopExpWeekly(clan, numTop, type = "all") {
    const result = await calculateTopExp(clan, 'weekly', numTop, type);
    return result;
}

// uses the calculate top method with the monthly table
async function calculateTopExpMonthly(clan, numTop, type = "all") {
    const result = await calculateTopExp(clan, 'monthly', numTop, type);
    return result;
}

// uses the calculate top method with the event table
async function calculateTopExpEvent(clan, numTop, type = "all") {
    const result = await calculateTopExp(clan, 'event', numTop, type);
    return result;
}

/**
 * Adds new members and updates experience in the experience table for existing members
 * @param {String} clan clan to update
 */
async function updateClan(clan = 'Sorrow Knights') {
    var members = await getClanMembers(clan);
    await addNewMembers(clan);
    var new99sAnd120s = await db.updateExpUsers(members);
    return new99sAnd120s;
}

// makes copies of the experience table at a given job time for daily, weekly, and monthly
async function setDailyXP() {
    await db.duplicateTable('daily');
}

async function setWeeklyXp() {
    await db.duplicateTable('weekly');
}

async function setMonthlyXp() {
    await db.duplicateTable('monthly');
}

async function setEventXp() {
    await db.duplicateTable('event');
}

async function setEventEndXp() {
    await db.duplicateTable('end');
}

//setDailyXP('Sorrow Knights');
//calculateTopExp('Sorrow Knights');
//setMonthlyXp('Sorrow Knights');
//addNewMembers('Sorrow Knights');

async function testCode() {
    var result = await getUserTable('Z0CI');
    console.log(result);
}

//testCode();
//getUserRank(`Z0CI`, `Sorrow Knights`, "combat", "daily");

module.exports = {
    getClanMembers,
    addClan,
    addNewMembers,
    updateClan,
    setDailyXP,
    setWeeklyXp,
    setMonthlyXp,
    setEventXp,
    setEventEndXp,
    calculateTopExpDaily,
    calculateTopExpWeekly,
    calculateTopExpMonthly,
    calculateTopExpEvent,
    getUserTable,
    getClanUserData,
    getClanExp,
    getUserRank,
    getUserRSN,
    setUserRSN,
    calculateClanAllTimedUserRank,
    calculateClanTimedTotalExp
}