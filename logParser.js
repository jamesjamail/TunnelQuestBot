const {parsePrice} = require('./utils');

const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(.*)'$/;
const WTS_REGEX = /WTS(.*?)(?=WTB|$)/gi;

let outgoing = [];
let pullInterval = 1 * (1000 * 60);
let itemList = [];

//stream log file(s)
if (require.main === module) {
    const Tail = require('tail').Tail;
    tail = new Tail ("C:\\Program Files (x86)\\Sony\\EverQuest\\Logs\\eqlog_Auclog_P1999Green.txt");
    tail.on("line", function(data) {
        parseLog(data, 'GREEN');
    })

    tail.on("error", function(error) {
        console.log('ERROR: ', error)
    })
    setInterval(() => {
        const db = require('./db.js');
        db.upkeep();
        db.getWatches((results) => {
            itemList = results;
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

function parseLog(text, logServer) {
    //test if is auction
    const auction_text = text.match(AUC_REGEX);
    if (auction_text) {
        const client = require('./client.js');
        client.streamAuction(text.replace(/[|]+/g, '|'), logServer);
        const auction_user = auction_text[1];
        const auction_contents = auction_text[2];
        const auctionWTS = filterWTS(auction_contents);
        if (auctionWTS) {
            itemList.forEach(({item_name, user_id, user_name, price, server}) => {
                if (server === logServer && auctionWTS.includes(item_name)) {
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
    sendDiscordMessages();
}

function sendDiscordMessages() {
    const client = require('./client.js');
    while (outgoing.length > 0) {
        let msg = outgoing.pop()
        // console.log(msg)
        client.pingUser(msg.userName, msg.seller, msg.itemName, msg.sellingPrice, msg.server, msg.fullAuction)
    }
}

module.exports = {parseLog, filterWTS};