const Tail = require('tail').Tail;
const db = require('./db.js');
const client = require('./index.js');
// const path = require('./path');

//stream log file(s)

//fakelog for testing...
// tail = new Tail ('./fakeLogs/fakeLog.txt');
tail = new Tail ("C:\\Program Files (x86)\\Project 1999\\Sony\\EverQuest\\Logs\\eqlog_Auclog_P1999Green.txt")

var outgoing = [];

tail.on("line", function(data) {
    parseLog(data);
    
})
tail.on("error", function(error) {
    console.log('ERROR: ', error)
})

//remove any WTB sections from seller message
function filterWTS(wordsArray) {
    console.log(wordsArray);
    if (!wordsArray.includes('wtb')) {
        //base case, no wtb in msg
        return wordsArray
    } else {
        var auction = wordsArray;
        let trim = [];
        auction.forEach((word, index) => {
            if (word === 'wtb') {
                trim[0] = index;
                trim[1] = auction.indexOf('wts', index);
                if (trim[1] === -1) {
                    trim[1] = auction.length;
                }
                auction.splice(trim[0], trim[1]-trim[0]);
                // console.log('filtred auction = ', auction)
                return;
            }
        })
        return filterWTS(auction);
    }
}

function parseLog(text) {
    //trim timestamp
    var auction = text.toLowerCase().slice(text.indexOf(']') + 2, text.length);
    //split words into array
    var words = auction.split(' ');
    //test if is auction
    if (words[1] === 'auction,') {
        //trim single quotes
        words[2] = words[2].slice(1);
        // words[words.length - 1] = words[words.length - 1].slice(words[words.length - 1].length-1);
        // console.log('prefilter words = ', words);
        words = filterWTS(words);
        auction = words.join(' ');
        // console.log('postfilter words = ', words);
        if (words.length > 2) {

            db.getWatches((results) => {
                let itemList = results;
                itemList.forEach(({item_name, user_id, user_name, price, server}) => {
                    if (server === 'green' && auction.includes(item_name)) {
                            console.log('match found: ', item_name, user_id, user_name,  price, server);
                            auction = auction.slice(auction.indexOf(item_name), auction.length);
                            logPrice = parsePrice(auction, item_name.length);
                            if (logPrice && logPrice <= price) {
                                console.log("bam! meets price criteria", logPrice, price)
                                var seller = words[0];
                                let msg = {userId: user_id, itemName: item_name, sellingPrice: logPrice, seller: seller, server: server}
                                outgoing.push(msg)
                            }
                        }
                    }
                )
                // checkItems(words, results)
            })

            //store playername


        }
        //remove wtb portion from auction message (if any)
        // console.log('filtered words = ', words)
    }
    sendMsgs();
}

function parsePrice(text, start) {
    let price = '';
    for (let i = start; i < text.length; i++) {
        //TODO: need to check for k or pp
        if (text[i].match(/[a-z]/)) {
            if (price.length === 0) {
                return null;
            } else {
                return Number(price);
            }
        } else if (text[i].match(/[0-9]/)) {
            price += text[i];
        }
    }
    return Number(price);
}


function sendMsgs() {
    while (outgoing.length > 0) {
        let msg = outgoing.pop()
        console.log(msg)
        client.pingUser(msg.seller, msg.itemName, msg.sellingPrice, msg.server)
    }
}

function checkItems(auction, items) {
    items.forEach((item) => {
        if (auction.includes(item[0])) {
            console.log('match found')
        }
    })

}
    
    //make a storage array for found watched items in message
    //stop parsing on end of message.  if 'WTB'  or 'WTT' skip to next 'WTS' or end of message
    //if a watched item is detected, check for price afterwards, add item and price to array, repeat
    //end of message, send the pings for each item found
    

    


    //TODO: check that second word is "'WTS" too...
    // if (words[1] === 'auctions,') {
        //     // console.log("auction detected, words = ", words, "text = ", text);
        // db.watchedItems((error, results) => {
        //     var watchedItems = results
        //     for (let i = 0; i < watchedItems.length; i++) {
        //             if (auction.includes(watchedItems[i].name)) {
        //             var price = auction.substring(auction.indexOf(watchedItems[i].name) + watchedItems[i].name.length, auction.length-1);
        //             console.log(price);
        //             var price = Number(price.trim());
        //             console.log(price);
        //             console.log('MATCH FOUND, price = ', price);
        //             db.getItemId(watchedItems[i].name, (res) => db.getWatches(res, (res) => {
        //                     minPrice = res[0].price;
        //                 console.log(price, '|', minPrice);
        //                 if (price <= minPrice) {
        //                         console.log('pinging user...')
        //                     client.pingUser(words[0], watchedItems[i].name, price, 'blue');
        //                 }
        //             }));
        //         }
        //     }
    //     });
    // }
