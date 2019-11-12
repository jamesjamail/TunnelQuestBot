const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'jamesjamail',
  database: 'tunnelquestdb'
})

client.connect(() => console.log('connected to postgres db'));

const findUserId = async function(user) {
    //userId to be returned
    var userId;
    //check if a user exists in user table already
    let query = `SELECT id FROM users WHERE name = "${user}"`;
    console.log(query);
    await client
        .query(query)
        .then((results) => {
            console.log(results);
            // if (results === null) {
            //     //if not, insert individual user
            //     let subQuery = 'INSERT INTO users (name) VALUES ' + user;
            //      client.query(subQuery)
            //         .then((results) => {
            //             console.log(results);
            //             client.query(query)
            //             .then((results) => {
            //                 userId = results;
            //             })
            //         })
            // }
            // else {
            //     //store user id from results
            //     userId = results;
            // }
        })
        .catch((err) => console.log(err))
    //return user id
    // return userId;
}


findUserId("testUser1");

const findItemId = function(item) {
    //check if item exists in item table already...
        //if not, insert individual item
    //return item id
}

const addWatch = function(user, item, price) {
    let myUser = findUserId(user);
    let myItem = findItemId(item);


    //if userid and itemid already exist in table, need to update existing entry
    //else insert new watch
}