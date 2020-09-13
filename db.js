const { Client } = require('pg');
const settings = require('./settings.json');

const connection = new Client({
  host: settings.sql.host,
  port: settings.sql.port,
  user: settings.sql.user,
  database: settings.sql.database,
  password: settings.sql.password
});

connection.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        console.log('connected to postgres db');
    }
});

function findOrAddUser(user) {
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
                    connection.query(queryStr, [user], (err, results) => {
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

function findOrAddItem(item) {
    return new Promise((resolve, reject) => {
        //SELECT user ID based on ITEMNAME
        let queryStr = "SELECT id FROM items WHERE name = $1";
        connection.query(queryStr, [item])
        .then((results) => {
            if (results.rows.length === 0) {
                let queryStr = "INSERT INTO items (name) VALUES ($1) RETURNING id";
                connection.query(queryStr, [item], (err, results) => {
                    
                    if (err) {
                        reject(err);
                    }  else {
                        resolve(results.rows[0].id);
                    }
                })
            } else {
                resolve(results.rows[0].id);
            }
        })
        .catch((err) => {
            console.log(err)
        })
    
    })
}

//TODO: this function should not return duplicate items, just the item once with lowest price
function getWatches(callback) {

    //TODO: add WHERE active = true condition
    const query =
        "SELECT watches.id AS watch_id, items.name AS item_name, user_id, users.name AS user_name, price, server " +
        "FROM items " +
        "INNER JOIN watches ON watches.item_id = items.id " +
        "INNER JOIN users ON watches.user_id = users.id;";
    connection.query(query)
    .then((res) => {
        callback(res.rows)
    })
    .catch((err) => console.log(err))
}

function addWatch(user, item, price, server) {
    //check for 'k' and cast price to number
    let numPrice;
    if (price != -1) {
        numPrice = price.match(/[0-9.]*/gm);
        numPrice = Number(numPrice[0]);
        if (price.includes('K')) {
            numPrice *= 1000;
        }
    } else {
        numPrice = -1;
    }
    
    findOrAddUser(user)
        .then((results) => {
            let userId = results;
            findOrAddItem(item)
            .then((results) => {
                let itemId = results;
                let queryStr = "" +
                    "UPDATE watches " +
                    "SET user_id = $1, item_id = $2, price = $3, server = $4 " +
                    "WHERE user_id = $1 AND item_id = $2 AND server = $4";
                connection.query(queryStr, [userId, itemId, numPrice, server])
                .then((results) => {
                    if (results.rowCount === 0) {
                        let queryStr = "" +
                            "INSERT INTO watches (user_id, item_id, price, server, datetime) " +
                            "VALUES ($1, $2, $3, $4, current_timestamp)";
                        connection.query(queryStr, [userId, itemId, numPrice, server]);
                    }
                })
        .catch(console.error);
        })
    }
}

function endWatch(user, item, server) {
    // let item = unsanitizedItem.replace(/\'/g, "''");

    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        findOrAddItem(item)
        .then((results) => {
            let itemId = results;
            //TODO: change DELETE to UPDATE and set active to false
            let queryStr = 'DELETE FROM watches WHERE user_id = $1 AND item_id = $2 AND server = $3';
            connection.query(queryStr, [userId, itemId, server]);
        })
    })
    .catch(console.error);
}

function endAllWatches(user) {
    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        //TODO: change DELETE to UPDATE and set active to false
        let queryStr = 'DELETE FROM watches WHERE user_id = $1';
        connection.query(queryStr, [userId]);
    })
    .catch((err) => {
        console.log(err);
    })
}

function showWatch(user, item, callback) {
    // console.log('db.showWatch item = ', item)
    // let item = unsanitizedItem.replace(/\'/g, "''");

    findOrAddUser(user)
    .then((results) => {
        let userId = results;
        findOrAddItem(item)
        .then((results) => {
            let itemId = results;
            //TODOP: add WHERE active = true condition
            let queryStr = '' +
                'SELECT items.name, price, server, datetime ' +
                'FROM watches ' +
                'INNER JOIN items ON items.id = item_id ' +
                'WHERE user_id = $1 AND item_id = $2';
            connection.query(queryStr, [userId, itemId])
            .then((res) => {
                if (res.rowCount === 0) {
                    callback({success: false})
                }  else {
                    const formattedPrice = res.rows[0].price === -1 ? 'No price criteria' : res.rows[0].price
                    callback({success: true, msg:`\`${res.rows[0].name} | ${formattedPrice} | ${res.rows[0].server} | ${res.rows[0].datetime}\``})
                }
            })
            .catch((err) => {
                console.log(err);
            })
        })
        .catch((err) => {
            console.log(err);
        })
    })
    .catch((err) => {
        console.log(err);
    })
}

function showWatches(user, callback) {
    findOrAddUser(user)
    .then((userId) => {
        //TODO: add WHERE active = true condition
        let queryStr = '' +
            'SELECT items.name, price, server, datetime ' +
            'FROM watches ' +
            'INNER JOIN items ON items.id = item_id ' +
            'WHERE user_id = $1';
        connection.query(queryStr, [userId])
            .then((res) => {
                if (res.rowCount === 0) {
                    callback({success: false})
                }  else {
                    callback({success: true, msg: res.rows})
                }
            })
            .catch((err) => {
                console.log(err);
            })
    })
    .catch((err) => {
        console.log(err);
    })
}

function extendAllWatches(user) {
        //TODO: add WHERE active = true condition
    let  queryStr = '' +
        'UPDATE watches ' +
        'SET datetime = current_timestamp ' +
        'FROM users ' +
        'WHERE watches.user_id = users.id AND users.name = $1 ';
    connection.query(queryStr, [user]);
}

function blockSeller(user, seller, watchId, server) {
    //if watchId provided, block based on watch
    if (watchId !== undefined) {
        const queryStr = 'CASE WHEN NOT EXISTS (SELECT id FROM blocked_seller_by_watch WHERE seller = $1 AND watchId = $2)' +
        ' THEN INSERT INTO blocked_seller_by_watch (seller, watchId) VALUES ($1, $2)'
        connection.query(queryStr, [seller, watchId]).catch(console.error);
    } else {
        //otherwise, block account wide (all watches)
        if (server) {
            const queryStr = 'CASE WHEN NOT EXISTS (SELECT id FROM blocked_seller_by_user WHERE seller = $1 AND user = $2 AND server = $3)' +
            ' INSERT INTO blocked_seller_by_user (seller, user, server) VALUES ($1, $2, $3)'
            connection.query(queryStr, [seller, user, server]).catch(console.error);
        } else {
            const queryStr = 'CASE WHEN NOT EXISTS (SELECT id FROM blocked_seller_by_user WHERE seller = $1 AND user = $2)' +
            ' INSERT INTO blocked_seller_by_user (seller, user) VALUES ($1, $2)'
            connection.query(queryStr, [seller, user]).catch(console.error);
        }
    }
}

function unblockSeller(user, seller, watchId, server) {
    //if watchId provided, unblock based on watch
    if (watchId !== undefined) {
        const queryStr = 'DELETE FROM blocked_seller_by_watch WHERE seller = $1 AND watchId = $2)'
        connection.query(queryStr, [seller, watchId]).catch(console.error);
    } else {
        //otherwise, block account wide (all watches)
        if (server) {
            const queryStr = 'DELETE FROM blocked_seller_by_user WHERE seller = $1 AND user = $2 AND server = $3)';
            connection.query(queryStr, [seller, user, server]).catch(console.error);
        } else {
            const queryStr = 'DELETE FROM blocked_seller_by_user WHERE seller = $1 AND user = $2)'
            connection.query(queryStr, [seller, user]).catch(console.error);
        }
    }
}

//TODO:
function snooze(type, id, hours = 6) {
    switch(type.toUpperCase()) {
        case 'WATCH':
            //insert into watch snoooze
            break;
        case: 'USER':
            //insert into account snooze
            break;
    }
}

//TODO:
function unsnooze(type, id, hours = 6) {
    switch(type.toUpperCase()) {
        case 'WATCH':
            //insert into watch snoooze
            break;
        case: 'USER':
            //insert into account snooze
            break;
    }


function validateWatchNotification(userId, watchId, seller) {    
    let isValid;

    //check communication history to see if notified in the past 15 minutes
    const queryStr = "SELECT * FROM communication_history WHERE watchId = $1 AND seller = $2 AND dateTime > now() - interval '15 days'";
    connection.query(queryStr, [watchId, seller])
        .then((res) => {
            if (res.rows && res.rows.length > 0) {
                isValid = false;
                return;
            }
            //check blocked sellers for both watches and users - TODO: Test this query
            const queryStr = "SELECT DISTINCT * FROM blocked_seller_by_watch FULL JOIN blocked_seller_by_user ON blocked_seller_by_watch.seller = blocked_seller_by_user.seller WHERE watchId IN ($1, null) AND userId IN ($2, null) AND seller = $3;'
            connection.query(queryStr, [watchId, userId, seller])
                .then((res) => {
                    if (res.rows && res.rows.length > 0) {
                        isValid = false;
                        return;
                    }
                })
        })
        .catch(console.error)
    
    return isValid;
}

function upkeep() {
    //TODO: change delete to update and set active to false
    let query = "DELETE FROM watches WHERE datetime < now() -  interval '7 days'";
            connection.query(query)
                .then((res) => {
                    //TODO: pipe this to a private health_status channel on discord on devs have access to - write a log for every watch notification, command entry, etc.
                    // console.log('Upkeep completed. Removed ', res.rowCount, ' old watches.')
                })
                .catch(console.error)
}

module.exports = {addWatch, endWatch, endAllWatches, extendAllWatches, showWatch, showWatches, getWatches, validateWatchNotification, upkeep};