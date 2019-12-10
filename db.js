const { Client } = require('pg');
const moment = require('moment');
const token = require('./auth.json');

console.log(moment().utc().format())

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

const watchedItems = function(callback) {
    //select all names from items tables
    //SELECT name, userId, from items innerjoin users-items
    let query = "SELECT items.name FROM items";   
    client
        .query(query)
        .then((results) => {
          callback(results.rows);
        })
        .catch((err) => console.log(err))
}

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
    //TODO: check if a watch exists before adding
    //if userid and itemid already exist in table, need to update existing entry
    
    //insert new watch
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
                    let query = 'INSERT INTO watches (user_id, item_id, price, server, datetime) VALUES ($1, $2, $3, $4, current_timestamp)'
                    client.query(query, [myUserId, myItemId, price, server]);
                }
            })
        }
    });
}





//testing

// getItemId('thick banded belt', (res) => getWatches(res, (res) => console.log(res)));

// getItemId('thick banded belt', (res) => console.log(res));
// getWatches(5, (res) => console.log(res));

module.exports = {addWatch, watchedItems, getItemId, getWatches};