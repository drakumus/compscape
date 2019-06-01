var mysql = require('mysql');
const secret = require('../Model/secret.json');
var rp = require('request-promise');
var stackCount = 0;

async function init_connection(){
    if(isCon){
        stackCount++;
        return true;
    }
    connection = mysql.createConnection({
        host: secret.host,
        user: secret.user,
        password: secret.password,
        database: secret.database
    });
    let p = new Promise((res, rej) => {
        connection.connect(function(err) {
            if(err) res(false);
            res(true);
        });
    });
    let result = await p;
    if(result) stackCount++;
    return result;
}

async function close_connection() {
    stackCount--;
    if(stackCount == 0) {
        connect.end();
        isCon = false;
    }
}

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

async function add_item(item_id, item_name) {
    isCon = await init_connection();
    if(!isCon) return null;
    
    const sql_query = `INSERT INTO \`item_db\` VALUES (${item_id}, '${item_name}')`;
    let res = await query_db(sql_query)
    close_connection();

    return res;
}

async function request_item_data(item_id) {
    // http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=2
    let options = {
        uri: `http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=${item_id}`,
        json: true,
        resolveWithFullResponse: true
    };
    try{
        let res = await rp(options);
        return res.body.item;
    } catch (StatusCodeError) {
        return null;
    }
}

async function test() {
    let res = await request_item_data(0);
    console.log(res);
}


//test();
//INSERT INTO `item_db` VALUES (0, 'bucket')
