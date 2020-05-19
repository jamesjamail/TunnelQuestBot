const {fetchAndFormatAuctionData} = require("./wikiHandler");
const {parsePrice} = require('./utils');
const {filterWTS} = require("./logParser.js");
const assert = require('assert');

const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(.*)'$/;

/* Format for test data:
    ["AUCTION_STRING",
     [{items.name AS item_name, user_id, users.name AS user_name, price, server}]],
*/
const tests = [
    [
        "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p'",
        [
            {item_name: 'SHIFTLESS DEEDS', user_id: '1234', user_name: 'testuser', price: 5200, server: 'GREEN'},
            {item_name: 'TEPID DEEDS', user_id: '5678', user_name: 'user2', price: 20, server: 'GREEN'}
        ],
        [
            {
                userId: '1234',
                userName: 'testuser',
                itemName: 'SHIFTLESS DEEDS',
                sellingPrice: 5100,
                seller: 'Stashboxx',
                server: 'GREEN',
                fullAuction: "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p'"
            }
        ]
    ],
    [
        "[Sun May 17 09:05:20 2020] Crakle auctions, 'WTS - Chestplate of the Constant . 2k.'",
        [
            {item_name: 'CHESTPLATE OF THE CONSTANT', user_id: '1234', user_name: 'testuser', price: 1000, server: 'GREEN'}
        ],
        []
    ]
];

// RUN TESTS
tests.forEach(test => {
    const testStr = test[0];
    const itemList = test[1];
    const expected = test[2];
    let result = parseLog(testStr, itemList, 'GREEN');
    console.log(result);
    assert(result.length == expected.length);
    for (let i = 0; i < result.length; i++) {
        for (let field in expected[i]) {
            assert(result[i][field] == expected[i][field]);
        }
    }
});

// TODO: this whole method should just be imported from logParser, and the discord client should be mocked
function parseLog(text, itemList, logServer) {
    const outgoing = [];
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
                            outgoing.push(msg)
                        }
                        else if (logPrice && logPrice <= price || price === -1) {
                            console.log("Meets price criteria", logPrice, price);
                            let msg = {userId: user_id, userName: user_name, itemName: item_name, sellingPrice: logPrice, seller: auction_user, server: server, fullAuction: text};
                            outgoing.push(msg)
                        }
                    }
                }
            ) 
        }
    }
    // sendMsgs();
    return outgoing;
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
