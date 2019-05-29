const db = require(`./database.js`);
var rp = require('request-promise');

const items_endpoint = ""
const exchange_endpoint = "http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=";

async function getItemPrice(item) {
    let options = {
        uri: exchange_endpoint+item,
        json: true
    };
    let res = await rp(options);
}

module.exports = {

}