const Tail = require('tail').Tail;
const db = require('./db.js');
const client = require('./index.js');

//stream log file(s)

tail = new Tail ('./fakeLogs/fakeLog.txt');

tail.on("line", function(data) {
    parseLog(data);
})

tail.on("error", function(error) {
    console.log('ERROR: ', error)
})

function parseLog(text) {
    var words = text.toLowerCase().split(' ');
    var auction = text.toLowerCase();
    //TODO: check that second word is "'WTS" too...
    if (words[1] === 'auctions,') {
        // console.log("auction detected, words = ", words, "text = ", text);
        db.watchedItems((error, results) => {
            var watchedItems = results
            for (let i = 0; i < watchedItems.length; i++) {
                if (auction.includes(watchedItems[i].name)) {
                    var price = auction.substring(auction.indexOf(watchedItems[i].name) + watchedItems[i].name.length);
                    console.log('MATCH FOUND, price = ', price);
                    client.pingUser(words[0], watchedItems[i].name, price, 'blue');
                }
            }
        });
    }
}