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
async function getClanMembers(clan) {
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

/**
 * Adds members that don't already exist in the db that are in the specified clan to the db
 * @param {String} clan clan name
 */
async function addNewMembers(clan) {
    var members = await getClanMembers(clan);
    var dbMembers = await db.getClanMembers(clan);
    var newMembers = members.filter(val => !dbMembers.includes(val));

    if(newMembers.length > 0) {
        await db.addUsers(newMembers, clan);
        await db.addExpUsers(newMembers, clan);
    }
}

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

function difSkills(skillData1, skillData2) {
    var result = {}
    for(var skill in skillData1) {
        result[skill] = skillData1[skill] - skillData2[skill];
    }

    return result;
}

async function getUserTable(name) {
    await db.updateExpUser(name, 'experience');
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

/**
 * Performs a dif on the total exp for the experience table and a given time table (daily, weekly, monthly).
 * The dif list is then sorted and the numTop users are presented.
 * @param {String} clan clan you wish to find the top exp for a given time period for
 * @param {String} timeSlot time table you wish to reference: daily, weekly, monthly
 * @param {number} numTop between 1 and # members in the clan
 */
async function calculateTopExp(clan, timeSlot, numTop) {
    // find and store the difference between the timed table and the current exp table
    var current_data = await db.getClanData(clan);
    var timed_data = await db.getClanData(clan, timeSlot);
    var memberTotals = {}; // where the fuck did the rest go?
    for(var i in timed_data) {
        var name = timed_data[i].name
        var currentTotal = calculateTotalExp(current_data[i]);
        var timedTotal = calculateTotalExp(timed_data[i]);
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

// uses the calculate top method with the daily table
async function calculateTopExpDaily(clan, numTop) {
    const result = await calculateTopExp(clan, 'daily', numTop);
    return result;
}

// uses the calculate top method with the weekly table
async function calculateTopExpWeekly(clan, numTop) {
    const result = await calculateTopExp(clan, 'weekly', numTop);
    return result;
}

// uses the calculate top method with the monthly table
async function calculateTopExpMonthly(clan, numTop) {
    const result = await calculateTopExp(clan, 'monthly', numTop);
    return result;
}

/**
 * Adds new members and updates experience in the experience table for existing members
 * @param {String} clan clan to update
 */
async function updateClan(clan) {
    var members = await getClanMembers(clan);
    await addNewMembers(clan);
    await db.updateExpUsers(members);
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

//setDailyXP('Sorrow Knights');
//calculateTopExp('Sorrow Knights');
//setMonthlyXp('Sorrow Knights');
//addNewMembers('Sorrow Knights');

async function testCode() {
    var result = await getUserTable('Z0CI');
    console.log(result);
}

//testCode();

module.exports = {
    getClanMembers,
    addClan,
    addNewMembers,
    updateClan,
    setDailyXP,
    setWeeklyXp,
    setMonthlyXp,
    calculateTopExpDaily,
    calculateTopExpWeekly,
    calculateTopExpMonthly,
    getUserTable
}