const {parsePrice} = require('./utils');

// Poll DB for new watches on a set interval:
//                   m   s    ms
const pullInterval = .1 * 60 * 1000;

const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(.*)'$/;
const WTS_REGEX = /WTS(.*?)(?=WTB|$)/gi;

//stream log file(s)
if (require.main === module) {
    const client = require('./client.js');
    const db = require('./db.js');
    const settings = require('./settings.json');
    const tail = require('tail');
    const itemList = new Set();
    const log_tail = new tail.Tail (settings.logFilePath);
    log_tail.on("line", function(data) {
        parseLog(data, itemList, 'GREEN', client);
    });

    log_tail.on("error", function(error) {
        console.log('ERROR: ', error)
    });
    setInterval(() => {
        db.upkeep();
        db.getWatches((results) => {
            results.forEach((result) => itemList.add(result))
        })
    }, pullInterval)
}

//remove any WTB sections from seller message
function filterWTS(auction_contents) {
    const filteredWTS = [...auction_contents.matchAll(WTS_REGEX)];
    let auctionWTS = "";
    for (let section in filteredWTS) {
        auctionWTS += filteredWTS[section][1].trim() + " ";
    }
    return auctionWTS.toUpperCase().trim();
}

function parseLog(text, itemList, logServer, client) {
    const outgoing = [];
    //test if is auction
    const auction_text = text.match(AUC_REGEX);
    if (auction_text) {
        const auction_user = auction_text[1];
        const auction_contents = auction_text[2];
        client.streamAuction(auction_user, auction_contents.replace(/[|]+/g, '|'), logServer);
        // console.log('auction text = ', auction_text);
        // console.log('auction user = ', auction_user);
        // console.log('auction contents = ', auction_contents)
        // console.log('matchall test', auction_contents.matchAll(WTS_REGEX))
        const auctionWTS = filterWTS(auction_contents);
        if (auctionWTS) {
            // console.log("itemList", itemList);
            // console.log("auctionWTS", auctionWTS);
            itemList.forEach(({item_name, user_id, user_name, price, server}) => {
            // itemList.forEach(function(element) {
                // console.log('element', element, 'Object.keys/vals =', Object.keys(element), Object.values(element))
            // itemList.forEach(console.log) //works
                // console.log('logServer = ', logServer, 'server = ', server,);
                if (server === logServer && auctionWTS.includes(item_name)) {
                    console.log('item name = ', item_name, 'price = ', price, 'server =', server, 'logServer = ', logServer);
                        // console.log('match found: ', item_name, user_id, user_name,  price, server);
                        let filteredAuction = auctionWTS.slice(auctionWTS.indexOf(item_name), auctionWTS.length);
                        // console.log("filtered auction = ", filteredAuction);
                        let logPrice = parsePrice(filteredAuction, item_name.length);
                        if (price === -1 && logPrice === null) {
                            // console.log("match found - no price requirement", logPrice, price)
                            let msg = {userId: user_id, userName: user_name, itemName: item_name, sellingPrice: logPrice, seller: auction_user, server: server, fullAuction: text};
                            outgoing.push(msg);
                        }
                        else if (logPrice && logPrice <= price || price === -1) {
                            // console.log("Meets price criteria", logPrice, price)
                            let msg = {userId: user_id, userName: user_name, itemName: item_name, sellingPrice: logPrice, seller: auction_user, server: server, fullAuction: text};
                            outgoing.push(msg);
                        }
                    }
                }
            ) 
        }
    }
    sendDiscordMessages(client, outgoing);
}

function sendDiscordMessages(client, outgoing) {
    outgoing.forEach(msg => {
        client.pingUser(
            msg.userName,
            msg.seller,
            msg.itemName,
            msg.sellingPrice,
            msg.server,
            msg.fullAuction)
    });
}

module.exports = {parseLog, filterWTS};