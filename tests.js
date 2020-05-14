// const logParser = require('./logParser');
const {fetchAndFormatAuctionData} = require("./wikiHandler");
const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(.*)'$/;
const WTS_REGEX = /WTS(.*?)(?=WTB|$)/gi;

testStr = "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure 7k ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5k ...Spell: Tepid Deeds40p'";

//items.name AS item_name, user_id, users.name AS user_name, price, server
let itemList = [{item_name: 'SHIFTLESS DEEDS', user_id: '1234', user_name: 'testuser', price: 2000, server: 'GREEN'}];

parseLog(testStr, 'GREEN');




function parseLog(text, logServer) {
    console.log(text);
    //test if is auction
    const auction_text = text.match(AUC_REGEX);
    if (auction_text) {
        const auction_user = auction_text[1];
        const auction_contents = auction_text[2];
        fakeStreamAuction(auction_user, auction_contents, logServer); // for testing purposes, don't use client
        const auctionWTS = filterWTS(auction_contents);
        if (auctionWTS) {
            itemList.forEach(({item_name, user_id, user_name, price, server}) => {
                if (server === logServer && auctionWTS.includes(item_name)) {
                        console.log('match found: ', item_name, user_id, user_name, price, server);
                        let filteredAuction = auctionWTS.slice(auctionWTS.indexOf(item_name), auctionWTS.length);
                        console.log("filtered auction = ", filteredAuction);
                        let logPrice = parsePrice(filteredAuction, item_name.length);
                        if (price === -1 && logPrice === null) {
                            console.log("match found - no price requirement", logPrice, price);
                            let msg = {userId: user_id, userName: user_name, itemName: item_name, sellingPrice: logPrice, seller: auction_user, server: server, fullAuction: text};
                            // outgoing.push(msg)
                            console.log(msg)
                        }
                        else if (logPrice && logPrice <= price || price === -1) {
                            console.log("Meets price criteria", logPrice, price);
                            let msg = {userId: user_id, userName: user_name, itemName: item_name, sellingPrice: logPrice, seller: auction_user, server: server, fullAuction: text};
                            // outgoing.push(msg)
                            console.log(msg);
                        }
                    }
                }
            ) 
        }
    }
    // sendMsgs();
}

function filterWTS(auction_contents) {
    const filteredWTS = [...auction_contents.matchAll(WTS_REGEX)];
    let auctionWTS = "";
    for (let section in filteredWTS) {
        auctionWTS += filteredWTS[section][1].trim() + " ";
    }
    return auctionWTS.toUpperCase().trim();
}

function parsePrice(text, start) {
    // console.log("price text = ", text, "start = ", start, text.substring(start))
    let price = '';
    // let xMult = false; TODO: add flag in message that multiple are available
    for (let i = start; i < text.length; i++) {
        //if text is a k preceded by number
        if (text[i] === ('K') && price.length > 0){
            console.log("parsePrice price = ", Number(price) * 1000)
            return Number(price) * 1000;
        
            //if text is a x preceded by a number(s)
        }    else if (text[i].match(/[xX]/) && price.length > 0) {
            price = '';
            //if text is x followed by a number
        }   else if (text[i].match(/[xX]/) && text[i+1] !== undefined && text[i+1].match(/[0-9]/)) {
            price = '';
            let k = i+2
            while (text[k].match(/[0-9.]/)) {
                k++;
            }
            i = k;
        }
            //if text is a letter, the next item is being listed- return price
            else if (text[i].match(/[A-Z]/)) {
            if (price.length === 0) {
                console.log("parsePrice price = ", price)
                return null;
            } else {
                console.log("parsePrice price = ", price)
                return Number(price);
            }
            //otherwise if text is a number, add it to price string
        } else if (text[i].match(/[0-9.]/)) {
            price += text[i];
        }
    }
    console.log("parsePrice price = ", price)
    return Number(price);
}

function fakeStreamAuction(auction_user, auction_contents, server) {
    auction_contents = auction_contents.replace(/[|]+/g, '|');
    fetchAndFormatAuctionData(auction_user, auction_contents, server).then(formattedAuctionMessage => {
        // in the real code this would do:
        // bot.channels.cache.get(channelID).send(msg)
        // but instead just log:
        console.log(formattedAuctionMessage);
    });
}
