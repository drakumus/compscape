// Handles all work between the program and database.

var mysql = require('mysql');
const max = require(`./max.js`);
const secret = require(`./secret.json`);

var connection; // global to keep track of connection to mysql db
var isCon = false; // helpful global to see if the connection object was able to be set properly
var stackCount = 0; // frame counter that keeps track of number connections attempted.

// I'll talk about the next 3 methods in a group here since this solution took me a few hours of muddling to figure out
// First the problem:
// How do I avoid opening and closing a connection everytime I want to query the db.
// Turns out you don't need to make the query in the callback for the connect method from the mysql-node library
// The solution is to use promises to assert that you do have a connection hence the need for this first method
// We now have a connection and means to check that it's already set wiwth isCon as a helpful global that is set on connect and disconnect.
// Well now I can call my methods as much as I want as long as I close the connection at the end.
// Only one problem remains. If I call one of my methods from another method, how do I know which method call was the parent and where should the connection close?
// It's easy enough to leave the connection open when calling a child, but it's not so simple to look back and see who made the original connection call.
// The solution: a frame pointer of sorts labeled stackCount above. Increment it everytime init_connect is called, decrement it everytime close connection is called.
// Doing this, the only check I need to do is one for if the stackCounter is 0, at that point I can actually close the connection.
async function init_connection(){
    if(isCon) {
        stackCount++;
        return true;
    }
    connection = mysql.createConnection({
        host: secret.host,
        user: secret.user,
        password: secret.password,
        database: secret.database
    });

    let p = new Promise((res,rej) => {
        connection.connect(function(err) {
            if(err) res(false);
            res(true);
        });
    });
    let result = await p;
    if(result) stackCount++;
    return result;
}

// make a query to the db. This assumes a connection is already open to the db
async function query_db(sql) {
    // avoid making unneccesary queries.
    if(sql.length == 0) return true;
    var result = await new Promise((res,rej) => {
        connection.query(sql, function(err, result) {
            if (err) res(null);
            res(result);
        });
    });
    return result;
}

// discussed above. Main purpose is to end the connection to mysql db on the parent's call to close_connection
async function close_connection() {
    stackCount--;
    if(stackCount == 0) {
        connection.end();
        isCon = false;
    }
}

// get data for a specific clan by doing a left join on the user table to one of the experience tables (experience, daily, weekly, monthly)
async function getClanData(clan, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    const raw = await query_db(`SELECT * FROM user LEFT JOIN ${table} ON user.id = ${table}.user_id WHERE clan = '${clan}'`);
    close_connection();

    return raw;
}

async function getUserData(name, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    const raw = await query_db(`SELECT * FROM user LEFT JOIN ${table} ON user.id = ${table}.user_id WHERE name = '${name}'`);
    close_connection();

    return raw;
}

// this extrapolates the raw skill data of atk, str, and so on from a client query to runescape's runemetric lite endpoint.
async function extractSkillData(name) { 
    var raw = await max.listSkills(name).catch(function (rej){
        return {};
    });
    var skillData = {};
    if(raw["Ranged"] != null) {
        for(var skill in raw) {
            skillData[skill] = raw[skill].xp/10;
        }
    }
    return skillData;
}

async function extractSkillDataTable(name, table) {
    var raw = (await getUserData(name, table))[0];
    var data = {}
    if(typeof raw !== "object") {
        return data;
    }
    for(var i in raw) {
        var value = raw[i];
        if(typeof value == "number" && i != 'id' && i != 'user_id') {
            data[i] = value;
        }
    }

    return data;
}

// get an id for a single user
async function getIdUser(name) {
    isCon = await init_connection();
    if(!isCon) return null;

    const raw = await query_db(`SELECT \`id\` FROM \`user\` WHERE \`name\`= '${name}'`);
    close_connection();
    if(raw.length == 0) return false;
    return raw[0].id;
}

// widely used function that provides the users' IDs when names are provided
async function getIdUsers(names) {
    isCon = await init_connection();
    if(!isCon) return null;
    
    var sql = `SELECT \`id\`, \`name\` FROM \`user\` WHERE`;
    var result = {};
    for(var index in names) {
        var name = names[index];
        if(index == 0)
            sql += ` \`name\` = '${name}'`;
        else
            sql += ` OR \`name\` = '${name}'`;
    }
    const raw = await query_db(sql);
    close_connection();
    if (raw.length == 0) return false;
    
    for(var index in raw) {
        result[raw[index].name] = raw[index].id;
    }

    return result
}

// legacy function may delete in future
async function getTableIds(table) {
    // get all names already in DB
    var col = table == user ? 'id' : 'user_id';
    return getColData(col, table);
}

// gets column data from a table in the database with provided conditions
async function getColData(col, table, condition) {
    isCon = await init_connection();
    if(!isCon) return null;

    if(condition != null)
        sql = `SELECT \`${col}\` FROM \`${table}\` WHERE ${condition}`;
    else
        sql = `SELECT \`${col}\` FROM \`${table}\``;
    const raw = await query_db(sql);
    close_connection();
    if (raw == false) return [];

    var result = [];

    for(var packet in raw) {
        result.push(raw[packet][col]);
    }

    return result
}

async function getClanMembers(clan) {
    var members = await getColData('name', 'user', `\`clan\` = '${clan}'`)
    return members;
}


// UPDATES AND INSERTS

/**
 * A note on plurals:
 * In hindsight they are incredibly redundent and will be refactored out in the future. 
 */

// Add user to the user  table
async function addUser(name, clan) {
    isCon = await init_connection();
    if(!isCon) return null;

    var user_id = await getIdUser(name);
    var sql = `INSERT INTO \`user\`(\`name\`, \`clan\`) VALUES ('${name}','${clan}')`;
    const result = await query_db(sql);
    close_connection();
    return result;
}

// Add users to the user table. 
async function addUsers(names, clan) {
    isCon = await init_connection();
    if(!isCon) return null;
    
    var result = [];
    for(var index in names) { // TODO
        let name = names[index];
        const output = await query_db(`INSERT INTO \`user\`(\`name\`, \`clan\`) VALUES ('${name}','${clan}')`);
        result.push(output);
    }
    close_connection();
    return result;
}

// Add a single user to the exp tables, only if they already exist in the users tables.
async function addExpUser(name, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    var user_id = await getIdUser(name);
    if(user_id === false) {
        close_connection();
        return false;
    }
    var skillData = await extractSkillData(name);
    if(skillData["Ranged"] != null) {
        var sql = `INSERT INTO \`${table}\` (\`user_id\`, \`attack\`, \`defense\`, \`strength\`, \`constitution\`, \`ranged\`, \`prayer\`, \`magic\`, \`cooking\`, \`woodcutting\`, \`fletching\`, \`fishing\`, \`firemaking\`, \`crafting\`, \`smithing\`, \`mining\`, \`herblore\`, \`agility\`, \`thieving\`, \`slayer\`, \`farming\`, \`runecrafting\`, \`hunter\`, \`construction\`, \`summoning\`, \`dungeoneering\`, \`divination\`, \`invention\`) VALUES ('${user_id}', '${skillData["Attack"]}', '${skillData["Defence"]}', '${skillData["Strength"]}', '${skillData["Constitution"]}', '${skillData["Ranged"]}', '${skillData["Prayer"]}', '${skillData["Magic"]}', '${skillData["Cooking"]}', '${skillData["Woodcutting"]}', '${skillData["Fletching"]}', '${skillData["Fishing"]}', '${skillData["Firemaking"]}', '${skillData["Crafting"]}', '${skillData["Smithing"]}', '${skillData["Mining"]}', '${skillData["Herblore"]}', '${skillData["Agility"]}', '${skillData["Thieving"]}', '${skillData["Slayer"]}', '${skillData["Farming"]}', '${skillData["Runecrafting"]}', '${skillData["Hunter"]}', '${skillData["Construction"]}', '${skillData["Summoning"]}', '${skillData["Dungeoneering"]}', '${skillData["Divination"]}', '${skillData["Invention"]}')`;
        const result = await query_db(sql);
        close_connection();
        return result;
    } else {
        close_connection();
        return false;
    }
}

// Add users to the exp tables, only if they already exist in the users table.
async function addExpUsers(names, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    var ids = await getIdUsers(names);
    var sql = "";
    for(var name in ids) {
        var skillData = await extractSkillData(name);
        var id = ids[name];
        var result = [];
        if(skillData["Ranged"] != null) {
            sql = `INSERT INTO \`${table}\` (\`user_id\`, \`attack\`, \`defense\`, \`strength\`, \`constitution\`, \`ranged\`, \`prayer\`, \`magic\`, \`cooking\`, \`woodcutting\`, \`fletching\`, \`fishing\`, \`firemaking\`, \`crafting\`, \`smithing\`, \`mining\`, \`herblore\`, \`agility\`, \`thieving\`, \`slayer\`, \`farming\`, \`runecrafting\`, \`hunter\`, \`construction\`, \`summoning\`, \`dungeoneering\`, \`divination\`, \`invention\`) VALUES ('${id}', '${skillData["Attack"]}', '${skillData["Defence"]}', '${skillData["Strength"]}', '${skillData["Constitution"]}', '${skillData["Ranged"]}', '${skillData["Prayer"]}', '${skillData["Magic"]}', '${skillData["Cooking"]}', '${skillData["Woodcutting"]}', '${skillData["Fletching"]}', '${skillData["Fishing"]}', '${skillData["Firemaking"]}', '${skillData["Crafting"]}', '${skillData["Smithing"]}', '${skillData["Mining"]}', '${skillData["Herblore"]}', '${skillData["Agility"]}', '${skillData["Thieving"]}', '${skillData["Slayer"]}', '${skillData["Farming"]}', '${skillData["Runecrafting"]}', '${skillData["Hunter"]}', '${skillData["Construction"]}', '${skillData["Summoning"]}', '${skillData["Dungeoneering"]}', '${skillData["Divination"]}', '${skillData["Invention"]}');`;
            const output = await query_db(sql);
            result.push(output);
        }
    }
    close_connection();
    return result;
}

// Update the exp for a single user.
// Potential useful for users that want hourly tracking on skills and potential
// services built around that. Runemetric endpoing updates amazingly fast, even faster than the actual runemetric site.
async function updateExpUser(name, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    var skillData = await extractSkillData(name);
    var user_id = await getIdUser(name);
    if(skillData["Ranged"] != null) {   // when I first wrote this I did skillData == {} which obviously passes. Forgot that === was a thing
        var sql = `UPDATE \`${table}\` SET \`attack\` = '${skillData["Attack"]}', \`defense\` = '${skillData["Defence"]}', \`strength\` = '${skillData["Strength"]}', \`constitution\` = '${skillData["Constitution"]}', \`ranged\` = '${skillData["Ranged"]}', \`prayer\` = '${skillData["Prayer"]}', \`magic\` = '${skillData["Magic"]}', \`cooking\` = '${skillData["Cooking"]}', \`woodcutting\` = '${skillData["Woodcutting"]}', \`fletching\` = '${skillData["Fletching"]}', \`fishing\` = '${skillData["Fishing"]}', \`firemaking\` = '${skillData["Firemaking"]}', \`crafting\` = '${skillData["Crafting"]}', \`smithing\` = '${skillData["Smithing"]}', \`mining\` = '${skillData["Mining"]}', \`herblore\` = '${skillData["Herblore"]}', \`agility\` = '${skillData["Agility"]}', \`thieving\` = '${skillData["Thieving"]}', \`slayer\` = '${skillData["Slayer"]}', \`farming\` = '${skillData["Farming"]}', \`runecrafting\` = '${skillData["Runecrafting"]}', \`hunter\` = '${skillData["Hunter"]}', \`construction\` = '${skillData["Construction"]}', \`summoning\` = '${skillData["Summoning"]}', \`dungeoneering\` = '${skillData["Dungeoneering"]}', \`divination\` = '${skillData["Divination"]}', \`invention\` = '${skillData["Invention"]}' WHERE \`experience\`.\`user_id\` = '${user_id}'`;
        const result = await query_db(sql);
        close_connection();
        return result;
    } else {
        close_connection();
        return false;
    }
}

// Update the exp for all passed users in a specified table.
// table is a possible parameter since experience, daily, weekly, and monthly all have the same structure
async function updateExpUsers(names, table = 'experience') {
    isCon = await init_connection();
    if(!isCon) return null;

    var ids = await getIdUsers(names);
    var result = []
    for(var name in ids) {
        var user_id = ids[name];
        var skillData = await extractSkillData(name);
        if(user_id === 1446) {
            console.log(skillData["Woodcutting"]);
        }
        if(skillData["Ranged"] != null) {

            const output = await query_db(`UPDATE \`${table}\` SET \`attack\` = '${skillData["Attack"]}', \`defense\` = '${skillData["Defence"]}', \`strength\` = '${skillData["Strength"]}', \`constitution\` = '${skillData["Constitution"]}', \`ranged\` = '${skillData["Ranged"]}', \`prayer\` = '${skillData["Prayer"]}', \`magic\` = '${skillData["Magic"]}', \`cooking\` = '${skillData["Cooking"]}', \`woodcutting\` = '${skillData["Woodcutting"]}', \`fletching\` = '${skillData["Fletching"]}', \`fishing\` = '${skillData["Fishing"]}', \`firemaking\` = '${skillData["Firemaking"]}', \`crafting\` = '${skillData["Crafting"]}', \`smithing\` = '${skillData["Smithing"]}', \`mining\` = '${skillData["Mining"]}', \`herblore\` = '${skillData["Herblore"]}', \`agility\` = '${skillData["Agility"]}', \`thieving\` = '${skillData["Thieving"]}', \`slayer\` = '${skillData["Slayer"]}', \`farming\` = '${skillData["Farming"]}', \`runecrafting\` = '${skillData["Runecrafting"]}', \`hunter\` = '${skillData["Hunter"]}', \`construction\` = '${skillData["Construction"]}', \`summoning\` = '${skillData["Summoning"]}', \`dungeoneering\` = '${skillData["Dungeoneering"]}', \`divination\` = '${skillData["Divination"]}', \`invention\` = '${skillData["Invention"]}' WHERE \`experience\`.\`user_id\` = '${user_id}'; `);
            result.push(output);
        }
    }
    close_connection();
    return result;
}

// REMOVES

// Remove a single user from the exp table.
async function removeExpUser(name) {
    isCon = await init_connection();
    if(!isCon) return null;

    var id = await getIdUser(name);
    var sql = `DELETE FROM \`experience\` WHERE \`user_id\` = '${id}'`;
    const result = await query_db(sql);
    close_connection();
    return result;
}

// for some use case where you want to manually remove a multiple users from the exp table
// probably will never be used from the bot
async function removeExpUsers(names) {
    isCon = await init_connection();
    if(!isCon) return null;

    var result = [];
    for(var index in names) {
        var name = names[index];
        var id = await getIdUser(name);
        var sql = `DELETE FROM \`experience\` WHERE \`user_id\` = '${id}'`;
        const output = await query_db(sql);
        result.push(output);
    }
    close_connection();
    return result;
}

// remove a single user. Cascading deletes in child tables experience, daily, weekly, monthly
async function removeUser(name) {
    isCon = await init_connection();
    if(!isCon) return null;

    var id = await getIdUser(name);
    var sql = `DELETE FROM \`user\` WHERE \`id\` = '${id}'`;
    const result = await query_db(sql);
    close_connection();
    return result;
}

// remove multiple users
async function removeUsers(names) {
    isCon = await init_connection();
    if(!isCon) return null;
    
    var result = [];
    for(var index in names) {
        var name = names[index];
        var id = await getIdUser(name);
        var sql = `DELETE FROM \`user\` WHERE \`id\` = ${id}`;
        const output = await query_db(sql);
        result.push(output);
    }
    close_connection();
    return result;
}

// used to duplicate the exp table so I don't have to query all user data everytime I want to populate
// daily, weekly, or monthly exp (they all act as starting points that I do a dif on with the current exp)
async function duplicateTable(dupeName = 'daily') {
    isCon = await init_connection();
    if(!isCon) return null;
    
    await query_db(`DROP TABLE \`${dupeName}\``);
    await query_db(`CREATE TABLE \`${dupeName}\` LIKE \`experience\``)
    await query_db(`INSERT \`${dupeName}\` SELECT * FROM \`experience\``); // drop table to make sure it doesn't already exist

    close_connection();
}

// TEST CASES
// really just for my sanity not really much in the way of testing
// will come back to these

async function testAddUser() {
    var result = await addUser('Z0CI');
    console.log(result);
}

async function testAddUsers() {
    var result = await addUsers(['Z0CI', 'Wet Tofu'], 'Sorrow Knights');
    console.log(result); 
}

async function testAddExpUser() {
    var result = await addExpUser('Z0CI');
    console.log(result); 
}

async function testAddExpUsers() {
    var result = await addExpUsers(['Z0CI', 'Wet Tofu']);
    console.log(result); 
}

async function testUpdateExpUser() {
    var result = await updateExpUser('Z0CI');
    console.log(result); 
}

async function testUpdateExpUsers() {
    var result = await updateExpUsers(['Z0CI', 'Wet Tofu']);
    console.log(result);
}

async function testRemoveUser() {
    var result = await removeUser('Z0CI');
    console.log(result);
}

async function testRemoveUsers() {
    var result = await removeUsers(['Z0CI', 'Wet Tofu']);
    console.log(result);
}

async function testCode(){
    
    var result = await extractSkillDataTable('Boomshot2k7');
    console.log(result);
    //var result = await testAddUsers(['Z0CI', 'Wet Tofu'], 'Sorrow Knights');//await updateExpUsers(['Z0CI','10redturtle','Evil Fax', 'Sockobird']);
    //console.log(result);
}

//addUsers(['Weezy Weez','10redturtle','Aminishit']);
//testUpdateExpUser();
//updateUser('Z0CI');
//updateUser('Boomshot2k7');
//removeUser('Boomshot2k7');
//testCode();


module.exports = {
    addUser,
    addUsers,
	addExpUser,
    addExpUsers,
    updateExpUser,
    updateExpUsers,
    removeUser,
    getClanMembers,
    duplicateTable,
    getClanData,
    getUserData,
    extractSkillDataTable
}