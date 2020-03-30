var rp = require('request-promise');
var request = require('request');
//var db = require('./database.js')
// conversion table for the skill ids provided by the runemetric endpoint to readable skill names
const skill_id_lookup = {
	0:	"Attack",
	1:	"Defence",
	2:	"Strength",
	3:	"Constitution",
	4:	"Ranged",
	5:	"Prayer",
	6:	"Magic",
	7:	"Cooking",
	8:	"Woodcutting",
	9:	"Fletching",
	10:	"Fishing",
	11:	"Firemaking",
	12:	"Crafting",
	13:	"Smithing",
	14:	"Mining",
	15:	"Herblore",
	16:	"Agility",
	17:	"Thieving",
	18:	"Slayer",
	19:	"Farming",
	20:	"Runecrafting",
	21:	"Hunter",
	22:	"Construction",
	23:	"Summoning",
	24:	"Dungeoneering",
	25:	"Divination",
	26:	"Invention",
	27: "Archaeology"
};

const runemetric_endpoint = "https://apps.runescape.com/runemetrics/profile/profile?activities=12&user=";
const hiscore_endpoint = "https://secure.runescape.com/m=hiscore/index_lite.ws?player=";
const exp_cap = 13034431;
const elite_exp_cap = 36073511;

function getLevelFromExp(exp = 0)
{
	points = 0;
	output = 0;
	minlevel = 2; // first level to display
	maxlevel = 200; // last level to display

	if(exp == 0)
	{
		return 1;
	}

	for (let lvl = 1; lvl <= maxlevel; lvl++)
	{
		points += Math.floor(lvl + 300 * Math.pow(2, (lvl-1) / 7.));
		level_exp = Math.floor(points / 4);

		if((level_exp-1) > exp) // -1 so if someone has exact lvl exp it isnt counted as next level
		{
			return lvl-1; //had to be the previous level if next level exp is greater
		}
	}
}

console.log(getLevelFromExp(96015))

/**
 * Gets the user's data from the runemetric endpoint
 * @param {String} user user's rsn
 */
async function getUserData(user) {
	let options = {
    uri: runemetric_endpoint+user,
    json: true // Automatically parses the JSON string in the response
	};
	let res = await rp(options);
	return res;
}


async function getUserPNG(user) {
	var r = request(`http://secure.runescape.com/m=avatar-rs/${user}/chat.png`, (e, response) => {
	});

	return r;
}

async function getHiscoreData(user) {
	let options = {
		uri: hiscore_endpoint+user
	}
	let hiscores = await rp(options);
	let h_string_arr = hiscores.split(/\r?\n/);
	let data = {}
	let value = h_string_arr[0].split(',');
	data["Total"] = { level: value[1], exp: value[2] };
	for(let i = 1; i < 29; i++) {
		value = h_string_arr[i].split(',');
		data[skill_id_lookup[i-1]] = { level: value[1], exp: value[2]};
	}

	return data;
}

/**
 * Uses the getUserData function to make a human readable list of user's exp and level
 * @param {String} user user's rsn
 * @returns {Array} with index values of {xp: number, level: number}
 */
async function listSkills(user) {
	let data = await getUserData(user);
	let raw = data.skillvalues;
	let skills = {}
	for (var i = 0; i < raw.length; i++) {
		let name = skill_id_lookup[raw[i].id];
		skills[name] = {
			xp: raw[i].xp,
			level: raw[i].level
		};
	}

	return skills;
}

// this extrapolates the raw skill data of atk, str, and so on from a client query to runescape's runemetric lite endpoint.
async function extractSkillData(name) { 
    var raw = await listSkills(name).catch(function (rej) {
        return {};
    });
    var skillData = {};
    if(raw["Ranged"] != null) {
        for(var skill in raw) {
            skillData[skill] = raw[skill].xp/10;
        }
    } else {
        // runemetric profile is not public
        raw = await getHiscoreData(name).catch(function (rej) {
            return {};
        });
        for(var skill in raw) {
            skillData[skill] = parseInt(raw[skill].exp, 10);;
        }
    }
    return skillData;
}

/**
 * Calculates experience remianing for a player to max in runescape 3
 * @param {String} user name of the user to calculate
 */
async function calcExpToMax(user) {
	let skills = await extractSkillData(user);
	var expRemaining = 0;
	for(var skill in skills) {
		let exp = skills[skill];
		if(skill == "Invention") {
			if(exp < elite_exp_cap) {
				expRemaining += elite_exp_cap - exp;
			}
		} else {
			if(exp < exp_cap) {
				expRemaining += exp_cap - exp;
			}
		}
	};

	//console.log(expRemaining);
	return expRemaining;
}

async function calcExpToComp(user) {
	const trueMax = 104273167;
	const eliteTrueMax = 80618654;
	let skills = await extractSkillData(user);
	var totalRemainingExp = 0;
	let trueMaxSkillsLeft = {}

	let skills120 = ["Invention", "Dungeoneering", "Slayer", "Farming", "Herblore", "Archaeology"];
	for( var skill in skills ) {
		let cap = exp_cap;
		let exp = skills[skill];
		let remainingExp = 0;
		if( skills120.includes(skill) ) {
			cap = trueMax;
			if(skill === "Invention") {
				cap = eliteTrueMax;
			}
		}
		remainingExp = cap - exp;

		if( remainingExp > 0)
		{
			trueMaxSkillsLeft[skill] = remainingExp;
			totalRemainingExp += remainingExp;
		}
	}

	trueMaxSkillsLeft["Total"] = totalRemainingExp;
	
	return trueMaxSkillsLeft;
}

async function getHiscoreTable(user) {
	var hiscores = await getHiscoreData(user);
	var table = [["Skill", "Level", "Exp"]];
	for(var skill in hiscores) {
		table.push([skill, hiscores[skill].level, hiscores[skill].exp]);
	}
	return table;
}

async function canTheyJoinTheClan(user) {
	var hiscores = await getHiscoreData(user);
	var combat = await calcCombatLevel(user);
	if(hiscores.Total.level >= 2100 || combat >= 130)
		return {"canjoin": true, "combat": combat, "total": hiscores.Total.level};
	/*
	for(var skill in hiscores) {
		if(skill !== "Total"){
			if(Number(hiscores[skill].level) === 99)
				return true;
		}
	}
	*/
	return {"canjoin": false, "combat": combat, "total": hiscores.Total.level};
}

async function calcCombatLevel(user) {
	var hiscore = await getHiscoreData(user);
	var Att = Number(hiscore.Attack.level);
	var Str = Number(hiscore.Strength.level);
	var Mag = Number(hiscore.Magic.level);
	var Rng = Number(hiscore.Ranged.level);
	var Def = Number(hiscore.Defence.level);
	var Const = Number(hiscore.Constitution.level);
	var Pray = Number(hiscore.Prayer.level);
	var Summ = Number(hiscore.Summoning.level);
	var result = ((13/10) * Math.max((Att+Str), 2*Mag, 2*Rng) + Def + Const + (0.5 * Pray) + (0.5 * Summ))/4;
	return result;
}

async function getALog(user) {
	let data = await getUserData(user);
	let raw = data.activities;
	return raw;
}

async function test(){
	var data = await getALog('iSlash')
	console.log(data);
	/*
	Object {
		date: "16-May-2019 20:59",
		details: "I killed 3 Telos, the final defenders of the Heart of Gielinor.",
		text: "I killed 3 Telos."
	}
	*/
}

module.exports = {
	calcExpToMax,
	calcExpToComp,
	listSkills,
	skill_id_lookup,
	calcCombatLevel,
	canTheyJoinTheClan,
	getHiscoreTable,
	getHiscoreData,
	getALog,
	getUserPNG,
	getLevelFromExp
}