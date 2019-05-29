const db = require(`./database.js`);
var rp = require('request-promise');

const alog_endpoint = "https://apps.runescape.com/runemetrics/profile/profile?activities=20&user="

async function getALog(user) {
	let options = {
        uri: alog_endpoint+user,
        json: true // Automatically parses the JSON string in the response
        };
    let res = await rp(options);
	let alog = res.activities;
	return alog;
}

function getItemFromEntry(log_text = "") {
    const match_an = log_text.match(/(?<=I found an ).*/);
    const match_a = log_text.match(/(?<=I found a ).*/);
    const match_some = log_text.match(/(?<=I found some ).*/);

    if(match_an != null)
        return match_an;
    else if(match_a != null) {
        return match_a;
    }
    return match_some;
}

function getItems(log) {
    let items = []
    for(var i in log) {
        items.push(log[i].text);
    }
}

module.exports = {
    
}

