let rp = require('request-promise');

async function getHour() {
    let options = 
    {
        uri: "https://twitter.com/jagexclock"
    }

    let res = await rp(options);
    let regex= /(?<=The Voice of Seren is now active in the )[a-zA-Z ]*(?= districts)/g;
    let matches = res.match(regex);
    return matches[0];
}

module.exports = {
    getHour
}