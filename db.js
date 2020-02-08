const { Client } = require('pg');
const moment = require('moment');
const token = require('./auth.json');

const connection = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  database: 'tunnelQuest',
  password: token.password
})

connection.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        console.log('connected to postgres db');
    }
})


const findOrAddUser = function(user) {
    return new Promise((resolve, reject) => {
        //SELECT user ID based on USERNAME
        let queryStr = "SELECT id FROM users WHERE name = '" + user + "'"; 
        connection.query(queryStr, (err, results) => {
            if (err) {
                reject(err);
            } else {
                //IF USERNAME does not exist...
                if (results.rows.length === 0) {
                    let queryStr = "INSERT INTO users (name) VALUES ($1) RETURNING id";
                    connection.query(queryStr, [name], (err, res) => {
                        if (err) {
                            reject(err);
                        }  else {
                            resolve(results.rows[0].id);
                        }
                    })
                } else {
                    resolve(results.rows[0].id);
                }
            }
        })
    })
}



const findOrAddItem = function(item) {
    return new Promise((resolve, reject) => {
        //SELECT user ID based on ITEMNAME
        let queryStr = "SELECT id FROM items WHERE name = '" + item + "'"; 
        connection.query(queryStr, (err, results) => {
            if (err) {
                reject(err);
            } else {
                //IF USERNAME does not exists...
                if (results.rows.length === 0) {
                    let queryStr = "INSERT INTO items (name) VALUES ($1) RETURNING id";
                    connection.query(queryStr, [item], (err, results) => {
                        if (err) {
                            reject(err);
                        }  else {
                            console.log("line 64 res", results.rows[0])
                            resolve(results.rows[0].id);
                        }
                    })
                } else {
                    console.log("line 69 res", results.rows[0].id)
                    resolve(results.rows[0].id);
                }
            }
        })
    })
}

//TODO: this function should not return duplicate items, just the item once with lowest price
const getWatches = function(callback) {
    let query = "SELECT items.name AS item_name, user_id, users.name AS user_name, price, server FROM items INNER JOIN watches ON watches.item_id = items.id INNER JOIN users ON watches.user_id = users.id;";
    connection.query(query)
    .then((res) => {
        callback(res.rows)
    })
    .catch((err) => console.log(err))
}

const addWatch = function(user, item, price, server) {    
    //check for 'k' and cast price to number
    let numPrice = price.match(/[0-9.]*/gm);
    numPrice = Number(numPrice[0])
    if (price.includes('K')) {
        numPrice *= 1000;
    }
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        findOrAddItem(item)
        .then((results) => {
            let itemId = results;
            let queryStr = 'UPDATE watches SET user_id = $1, item_id = $2, price = $3, server = $4 WHERE user_id = $1 AND item_id = $2 AND server = $4';
            console.log("add watch query", queryStr)
            connection.query(queryStr, [userId, itemId, numPrice, server])
            .then((results) => {
                console.log(results.rowCount)
                if (results.rowCount === 0) {
                    let queryStr = 'INSERT INTO watches (user_id, item_id, price, server, datetime) VALUES ($1, $2, $3, $4, current_timestamp)';
                    connection.query(queryStr, [userId, itemId, numPrice, server])
                }
            })
        })
        .catch((err) => {
            console.log(err);
        })
    })
};

const endWatch = function(user, item, server) {
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        findOrAddItem(item)
        .then((results) => {
            let itemId = results;
            let queryStr = 'DELETE FROM watches where user_id = $1 AND item_id = $2 AND server = $3';
            connection.query(queryStr, [userId, itemId, server]);
        })
    })
}

const endAllWatches = function(user) {
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        let queryStr = 'DELETE FROM watches where user_id = $1';
        connection.query(queryStr, [userId]);
        })
}

const showWatch = function(user, item, callback) {
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        findOrAddItem(item)
        .then((results) => {
            let itemId = results;
            let queryStr = 'SELECT items.name, price, server, datetime FROM watches INNER JOIN items ON items.id = item_id WHERE user_id = $1 AND item_id = $2';
            connection.query(queryStr, [userId, itemId])
            .then((res) => {
                if (res.rowCount === 0) {
                    callback({success: false})
                }  else {
                    callback({success: true, msg:`${res.rows[0].name}, ${res.rows[0].price}, ${res.rows[0].server}, ${res.rows[0].datetime}`})
                }
            })
        })
    })
    .catch((err) => {
        console.log(err);
    })
}    

const showWatches = function(user, callback) {
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        let queryStr = 'SELECT items.name, price, server, datetime FROM watches INNER JOIN items ON items.id = item_id WHERE user_id = $1';
        connection.query(queryStr, [userId])
            .then((res) => {
                if (res.rowCount === 0) {
                    callback({success: false})
                }  else {
                let watchList = '';
                res.rows.forEach((item) => {
                    let singleWatch = `${item.name}, ${item.price}, ${item.server}, ${item.datetime}  \n`;
                    watchList += singleWatch;                
                })
                callback({success: true, msg: watchList})
                }
            })
            .catch((err) => {
                console.log(err);
            })
    })
}

const upkeep = function() {
    let query = "DELETE FROM watches WHERE datetime < now() -  interval '7 days'"
            connection.query(query)
                .then((res) => {
                    console.log('Upkeep completed. Removed ', res.rowCount, ' old watches.')
                })
                .catch((err) => {
                    console.log(err);
                })
}

module.exports = {addWatch, endWatch, endAllWatches, showWatch, showWatches, getWatches, upkeep};