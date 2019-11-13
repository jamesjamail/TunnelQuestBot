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
                    var price = auction.substring(auction.indexOf(watchedItems[i].name) + watchedItems[i].name.length, auction.length-1);
                    console.log(price);
                    var price = Number(price.trim());
                    console.log(price);
                    console.log('MATCH FOUND, price = ', price);
                    db.getItemId(watchedItems[i].name, (res) => db.getWatches(res, (res) => {
                        minPrice = res[0].price;
                        console.log(price, '|', minPrice);
                        if (price <= minPrice) {
                            console.log('pinging user...')
                            client.pingUser(words[0], watchedItems[i].name, price, 'blue');
                        }
                    }));
                }
            }
        });
    }
}