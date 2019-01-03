var rp = require('request-promise');

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
	26:	"Invention"
};
const endpoint = "https://apps.runescape.com/runemetrics/profile/profile?user=";
const exp_cap = 13034431;
const elite_exp_cap = 36073511;

/**
 * Gets the user's data from the runemetric endpoint
 * @param {String} user user's rsn
 */
async function getUserData(user) {
	let options = {
    uri: endpoint+user,
    json: true // Automatically parses the JSON string in the response
	};
	let res = await rp(options);
	return res;
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

/**
 * Calculates experience remianing for a player to max in runescape 3
 * @param {String} user name of the user to calculate
 */
async function calcExpToMax(user) {
	let skills = await listSkills(user);
	var expRemaining = 0;
	for(var skill in skills) {
		let exp = skills[skill].xp/10;
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

module.exports = {
	calcExpToMax,
	listSkills,
	skill_id_lookup
}