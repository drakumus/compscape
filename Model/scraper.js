let rp = require('request-promise');

async function getHour() {
    let options = 
    {
        uri: "https://twitter.com/jagexclock"
    }

    let res = await rp(options);
    let regex= /(?<=The Voice of Seren is now active in the )[a-zA-Z ]*(?= districts)/g;
    let matches = res.match(regex);
    if(matches == null)
    {
        return "Error feetching voice of seren"
    }
    return matches[0];
}

getHour();

module.exports = {
    getHour
}