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

async function getClanMembers(clan = "Sorrow Knights") {
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

async function getClanUserData(clan = "Sorrow Knights") {
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

    // figure out best time to run this. (after name change check/fix?)
    let nameChangeMessage = "";
    if(goneMembers.length > 0)
    {
        console.log("goneMembers:")
        console.log(goneMembers);
        console.log("newMembers");
        console.log(newMembers);
    }
    for(let i = 0; i < goneMembers.length; i++)
    {
        let closest = await getClosestLeveledPlayerFromNewUsers(clan, goneMembers[i], newMembers, false);
        if(closest != null)
        {
            nameChangeMessage += `${goneMembers[i]} to ${closest.name}\n`;
        }
    }
    if(goneMembers.length > 0) {
        db.removeUsers(goneMembers);
    }

    return nameChangeMessage;
}

//addNewMembers("Sorrow Knights");

//addNewMembers("Sorrow Knights")
// TODO: Create function to remove members that are no longer in a specified clan in the table

/**
 * Calculates the total exp for a single row (user)
 * @param {RowData} rowdata index value of the object returned by the query that performs a left join on the user and an experience table 
 */
// remove invention from here if it's an event
function calculateTotalExp(rowdata, excludeInvention = false) {
    var total = 0;
    if(typeof rowdata !== "object") {
        return total;
    }
    for(var i in rowdata) {
        var data = rowdata[i];
        if(typeof data == "number" && i != 'id' && i != 'user_id' && (i != "invention" || !excludeInvention)) {
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

function calculateSkillingExp(rowdata, excludeInvention = false) {
    let combat = ['attack', 'strength', 'defence', 'constitution', 'ranged', 'magic', 'slayer', 'prayer', 'summoning', 'invention']
    if(excludeInvention) combat.pop();
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
    let user_data = await db.updateExpUser(name, 'experience');
    if(user_data != null) {
        let user_ach = {}
        user_ach[name] = user_data;
        ach_callback(user_ach);
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
	    case "event":
            timed_data = await db.getClanData(clan, 'event');
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

async function getTopSkillExp(skill, timedTable = 'experience', numTop = 3) {
    let expRes = await db.getSkillData(skill, 'experience');
    let timedRes = await db.getSkillData(skill, timedTable);

    let data = [];
    for ( let i = 0; i < timedRes.length; i++)
    {
        let obj = {};
        if(timedTable == 'experience')
        {
            obj[timedRes[i].Name] = expRes[i][skill]
        } else
        {
            obj[timedRes[i].Name] = expRes[i][skill] - timedRes[i][skill];
        }

        data.push(obj);
    }

    // sort the list until the top x players have been found
    var top = [];
    for(var i = 0; i < numTop; i++) {
        var largest = Object.keys(data)[0];
        for(var p in data) {
            if(data[p] > data[largest]) largest = p;
        }
        top.push({name: largest, exp: data[largest]});
        delete data[largest];
    }

    return top;
}

async function getFormattedTopSkillExp(skill, timedTable = 'experience', numTop = 3) {
    let expRes = await db.getSkillData(skill, 'experience');
    let timedRes = await db.getSkillData(skill, timedTable);

    let data = {};
    for ( let i = 0; i < timedRes.length; i++)
    {
        if(timedTable == 'experience') // total exp
        {
            data[timedRes[i].name] = expRes[i][skill];
        } else
        {
            data[timedRes[i].name] = expRes[i][skill] - timedRes[i][skill];
        }
    }

    // sort the list until the top x players have been found
    var top = [];
    for(var i = 0; i < numTop; i++) {
        var largest = Object.keys(data)[0];
        for(var p in data) {
            if(data[p] > data[largest]) largest = p;
        }
        top.push({x: largest, y: data[largest]});
        delete data[largest];
    }

    return top;
}

getClosestLeveledPlayerFromNewUsers("Sorrow Knights", "Z0CI", ["iSlash", "Mr Traumatik"])

async function getClosestLeveledPlayerFromNewUsers(_clan, _old_user, _new_users) {
    var current_data = await db.getClanData(_clan);
    var user_data = current_data.filter(player_data => player_data.name === _old_user);
    if(user_data.length > 1)
    {
        console.log("Error: invalid number of matches for user: " + user_data.length)
        return null;
    } else if(user_data.length === 0)
    {
        console.log("Error: No users found by that name")
        return null;
    } else
    {
        user_data = user_data[0];
    }
    var new_users_data = current_data.filter(player_data => _new_users.indexOf(player_data.name) > -1);
    var closest_user_data = {};

    const non_skill_fields = ['clan', 'name', 'id', 'user_id']
    let closer_user_found = false;
    for(new_user_data of new_users_data)
    {
        var num_clan_user_skills_closer = 0;
        var num_closest_user_skills_closer = 0;

        let has_less_exp = false;
        for(field in new_user_data)
        {
            // make sure we don't compare fields that don't associate with a skill.
            if(non_skill_fields.indexOf(field) > -1)
            {
                continue;
            }

            // We expect user_data to be smaller since we're searching for the name the user likely changed to which will have more recent, thus greater exp.
            let closest_user_diff = closest_user_data[field] - user_data[field];
            let clan_user_diff    = new_user_data[field]    - user_data[field];

            if(clan_user_diff < 0)
            {
                // can't be match since the older exp has less exp than the current. exp loss isn't possible
                has_less_exp = true;
                break; 
            }

            if(closest_user_diff < clan_user_diff && closest_user_diff >= 0)
            {
                num_closest_user_skills_closer++;
            } else
            {
                num_clan_user_skills_closer++;
            }
        }

        // don't attempt to check if user is closer if they have less exp
        if(has_less_exp)
        {
            continue;
        }

        if(num_clan_user_skills_closer > num_closest_user_skills_closer)
        {
            // clan user has skills closer than current closest, replace current closest
            // console.log(`${new_user_data.name} was found with ${num_clan_user_skills_closer} matches vs ${num_closest_user_skills_closer}`)
            closer_user_found = true;
            closest_user_data = new_user_data;
        }
    }

    if(closer_user_found)
    {
        return closest_user_data;
    } else
    {
        // no canidate found.
        // can only happen if there's no other user with higher exp in every skill
        return null;
    }
}

async function getClosestLeveledPlayerExp(_clan, _user_runescape_name, _use_hiscores = false) {
    var current_data = await db.getClanData(_clan);
    var user_data = current_data.filter(player_data => player_data.name === _user_runescape_name);

    if(!_use_hiscores)
    {
        // make sure there's an exact match on the user in the database. Otherwise throw errors
        if(user_data.length > 1)
        {
            console.log("Error: invalid number of matches for user: " + user_data.length)
            return null;
        } else if(user_data.length === 0)
        {
            console.log("Error: No users found by that name")
            return null;
        } else
        {
            user_data = user_data[0];
        }
    } else
    {
        user_data = {}
        try {
            raw_data = await max.extractSkillData(_user_runescape_name);
        } catch (err) {
            // failed to find user
            return null;
        }
        if(raw_data === {})
        {
            // user doesn't exist
            return undefined;
        }
        for(skill in raw_data)
        {
            user_data[skill.toLowerCase()] = raw_data[skill];
        }
        user_data['name'] = _user_runescape_name;
    }

    // If it's the first user in the database don't compare them against themselves.
    var closest_user_data = {};

    const non_skill_fields = ['clan', 'name', 'id', 'user_id']
    let closer_user_found = false;
    let self_found = false; // not sure what to do with this yet
    for(clan_user_data of current_data)
    {
        /*
        if(_user_runescape_name === clan_user_data.name) {
            // don't mark same user as closest user
            self_found = true;
            continue;
        }
        */
        if(clan_user_data.name === "Mr Traumatik") {
            console.log("here");
        }
        var num_clan_user_skills_closer = 0;
        var num_closest_user_skills_closer = 0;

        let has_less_exp = false;
        for(field in clan_user_data)
        {
            // make sure we don't compare fields that don't associate with a skill.
            if(non_skill_fields.indexOf(field) > -1)
            {
                continue;
            }

            // We expect user_data to be smaller since we're searching for the name the user likely changed to which will have more recent, thus greater exp.
            let closest_user_diff = closest_user_data[field] - user_data[field];
            let clan_user_diff    = clan_user_data[field]    - user_data[field];

            if(clan_user_diff < 0)
            {
                // can't be match since the older exp has less exp than the current. exp loss isn't possible
                has_less_exp = true;
                break; 
            }

            if(closest_user_diff < clan_user_diff && closest_user_diff >= 0)
            {
                num_closest_user_skills_closer++;
            } else
            {
                num_clan_user_skills_closer++;
            }
        }

        // don't attempt to check if user is closer if they have less exp
        if(has_less_exp)
        {
            continue;
        }

        if(num_clan_user_skills_closer > num_closest_user_skills_closer)
        {
            // clan user has skills closer than current closest, replace current closest
            console.log(`${clan_user_data.name} was found with ${num_clan_user_skills_closer} matches vs ${num_closest_user_skills_closer}`)
            closer_user_found = true;
            closest_user_data = clan_user_data;
        }
    }

    if(closer_user_found)
    {
        return closest_user_data;
    } else
    {
        // no canidate found.
        // can only happen if there's no other user with higher exp in every skill
        return null;
    }
}

/**
 * Performs a dif on the total exp for the experience table and a given time table (daily, weekly, monthly).
 * The dif list is then sorted and the numTop users are presented.
 * @param {String} clan clan you wish to find the top exp for a given time period for
 * @param {String} timeSlot time table you wish to reference: daily, weekly, monthly
 * @param {number} numTop between 1 and # members in the clan
 */
async function calculateTopExp(clan, timeSlot, numTop, catagory = "all", excludeInvention = false, isActiveEvent = false) {
    // find and store the difference between the timed table and the current exp table
    // TODO: Write isActiveEvent to a settings file! Don't pipe it down.
    var current_data = (timeSlot === "event" && !isActiveEvent) ?
                       await  db.getClanData(clan, "end"):
                       await db.getClanData(clan);
    var timed_data = await db.getClanData(clan, timeSlot);
    var memberTotals = {};
    for(var i in timed_data) {
        var name = timed_data[i].name;
        var currentTotal, timedTotal;
        if(catagory === "all") {
            currentTotal = calculateTotalExp(current_data[i], excludeInvention);
            timedTotal = calculateTotalExp(timed_data[i], excludeInvention);
        } else if (catagory === "combat") {
            currentTotal = calculateCombatExp(current_data[i]);
            timedTotal = calculateCombatExp(timed_data[i]);
        } else if (catagory === "skilling") {
            currentTotal = calculateSkillingExp(current_data[i], excludeInvention);
            timedTotal = calculateSkillingExp(timed_data[i], excludeInvention);
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

async function getUserRank(user, clan, catagory = "all", timeSlot, isActiveEvent = false) {
    //await db.updateExpUser(user);
    var current_data = //(timeSlot === "event" && !isActiveEvent) ? 
                        //await  db.getClanData(clan, "end"):
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
    const result = await calculateTopExp(clan, 'event', numTop, type, true);
    return result;
}

/**
 * Adds new members and updates experience in the experience table for existing members
 * @param {String} clan clan to update
 */
async function updateClan(clan = 'Sorrow Knights') {
    var members = await getClanMembers(clan);
    let changed = await addNewMembers(clan);
    var new99sAnd120s = await db.updateExpUsers(members);
    new99sAnd120s["changed"] = changed;
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
    calculateClanTimedTotalExp,
    getTopSkillExp,
    getFormattedTopSkillExp,
    getClosestLeveledPlayerExp
}
