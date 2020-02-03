const { Client } = require('pg');
const moment = require('moment');
const token = require('./auth.json');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  database: 'tunnelQuest',
  password: token.password
})

client.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        console.log('connected to postgres db');
    }
})

const findUserId = function(user, callback) {
    //userId to be returned
    var userId;
    //select userid from users tables
    let query = "SELECT id FROM users WHERE name = '" + user + "'";   
    client
        .query(query)
        .then((results) => {
            //if user does not exist...
            if (results.rows.length === 0) {
                //insert individual user
                addUser(user, (err) => {
                    if (err) {
                        callback(err, null);
                    } else {
                        findUserId(user, callback);
                    }
                })
            }
            else {
                //store user id from results
                userId = results.rows[0].id;
                callback(null, userId);
            }
        })
        .catch((err) => console.log(err))
}

const addUser = function(user, callback) {
    let query = "INSERT INTO users (name) VALUES ($1);"
    client.query(query, [user])
        .then(result => {
            callback(null, result);
        })
        .catch(error => {
            callback(error, null);
        })
};

const findItemId = function(item, callback) {
    //itemId to be returned
    var itemId;
    //select itemId from items tables
    let query = "SELECT id FROM items WHERE name = '" + item + "'";   
    client
        .query(query)
        .then((results) => {
            //if item does not exist...
            if (results.rows.length === 0) {
                //insert individual item
                addItem(item, (err) => {
                    if (err) {
                        callback(err, null);
                    } else {
                        findItemId(item, callback);
                    }
                })
            }
            else {
                //store item id from results
                itemId = results.rows[0].id;
                callback(null, itemId);
            }
        })
        .catch((err) => console.log(err))
}

const addItem = function(item, callback) {
    let query = "INSERT INTO items (name) VALUES ($1);"
    client.query(query, [item])
        .then(result => {
            callback(null, result);
        })
        .catch(error => {
            callback(error, null);
        })
};

const getItemId = function(item, callback) {
    //find item id
    let query = "SELECT id FROM items WHERE name = '" + item + "';";   
    client
        .query(query)
        .then((res)=> {
            callback(res.rows[0].id)
        })
        .catch((err) => console.log(err))
}

//TODO: this function should not return duplicate items, just the item once with lowest price
const getWatches = function(callback) {
    let query = "SELECT items.name AS item_name, user_id, users.name AS user_name, price, server FROM items INNER JOIN watches ON watches.item_id = items.id INNER JOIN users ON watches.user_id = users.id;";
    client
        .query(query)
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
    console.log('numPrice = ', numPrice)
    
    findUserId(user, (err, res) => {
        if (err) {
            console.log(err);
        } else {
            let myUserId = res;
            findItemId(item, (err, res) => {
                if (err) {
                    console.log(err)
                } else {
                    let myItemId = res;
                    let query = 'SELECT * from watches WHERE user_id = $1 AND item_id = $2 AND server = $3';
                    client.query(query, [myUserId, myItemId, server])
                    .then((results) => {
                        if (results.rows.length > 0){
                            let query = 'UPDATE watches SET user_id = $1, item_id = $2, price = $3, server = $4 WHERE user_id = $1 AND item_id = $2 AND server = $4';
                            client.query(query, [myUserId, myItemId, numPrice, server])
                            .catch((err) => console.log(err))
                        } else {
                            let query = 'INSERT INTO watches (user_id, item_id, price, server, datetime) VALUES ($1, $2, $3, $4, current_timestamp)';
                            client.query(query, [myUserId, myItemId, numPrice, server])
                            .catch((err) => console.log(err))
                        }
                    })
                }
            })
        }
    });
}

const endWatch = function(user, item, server) {
    findUserId(user, (err, res) => {
        if (err) {
            console.log(err);
        } else {
            let myUserId = res;
            findItemId(item, (err, res) => {
                if (err) {
                    console.log(err)
                } else {
                    let myItemId = res;
                    let query = 'DELETE FROM watches where user_id = $1 AND item_id = $2 AND server = $3'
                    client.query(query, [myUserId, myItemId, server]);
                }
            })
        }
    });
}

const showWatch = function(user, item, callback) {
    findUserId(user, (err, res) => {
        if (err) {
            console.log(err);
        } else {
            let myUserId = res;
            findItemId(item, (err, res) => {
                if (err) {
                    console.log(err)
                } else {
                    let myItemId = res;
                    let query = 'SELECT items.name, price, server, datetime FROM watches INNER JOIN items ON items.id = item_id WHERE user_id = $1 AND item_id = $2'
                    client.query(query, [myUserId, myItemId])
                        .then((res) => {
                            console.log('showWatch', res)
                            callback(`${res.rows[0].name}, ${res.rows[0].price}, ${res.rows[0].server}, ${res.rows[0].datetime}`)
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                }
            })
        }
    });
}

const showWatches = function(user, callback) {
    findUserId(user, (err, res) => {
        if (err) {
            console.log(err);
        } else {
            let myUserId = res;
            let query = 'SELECT items.name, price, server, datetime FROM watches INNER JOIN items ON items.id = item_id WHERE user_id = $1'
            client.query(query, [myUserId])
                .then((res) => {
                    let watchList = '';
                    res.rows.forEach((item) => {
                        let singleWatch = `${item.name}, ${item.price}, ${item.server}, ${item.datetime}  \n`;
                        watchList += singleWatch;
                    
                    })
                    callback(watchList)
                })
                .catch((err) => {
                    console.log(err);
                })
        }
    });
}

const upkeep = function() {
    let query = "DELETE FROM watches WHERE datetime < now() -  interval '7 days'"
            client.query(query)
                .then((res) => {
                    console.log('Upkeep completed. Removed ', res.rowCount, ' old watches.')
                })
                .catch((err) => {
                    console.log(err);
                })
}

module.exports = {addWatch, endWatch, showWatch, showWatches, getItemId, getWatches, upkeep};