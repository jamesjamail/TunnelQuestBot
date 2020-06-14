jest.unmock("./logParser.js");
const logParser = require("./logParser.js");

const logParserTests = {
    "properly parses a log line and matches a watch": {
        text: "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p'",
        itemList: [
            {item_name: 'SHIFTLESS DEEDS', user_id: '1234', user_name: 'testuser', price: 5200, server: 'GREEN'},
            {item_name: 'TEPID DEEDS', user_id: '5678', user_name: 'user2', price: 20, server: 'GREEN'}
        ],
        expectedAuctionUser: "Stashboxx",
        expectedAuctionContents: "wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p",
        expectedMatches: [
            {
                userName: 'testuser',
                seller: 'Stashboxx',
                itemName: 'SHIFTLESS DEEDS',
                sellingPrice: 5100,
                server: 'GREEN'
            }
        ]
    },
    "properly parses a log line and doesn't match any watches": {
        text: "[Sun May 17 09:05:20 2020] Crakle auctions, 'WTS - Chestplate of the Constant . 2k.'",
        itemList: [
            {item_name: 'CHESTPLATE OF THE CONSTANT', user_id: '1234', user_name: 'testuser', price: 1000, server: 'GREEN'}
        ],
        expectedAuctionUser: "Crakle",
        expectedAuctionContents: "WTS - Chestplate of the Constant . 2k.",
        expectedMatches: []
    }
}

// RUN TESTS
for (let testCase in logParserTests) {
    const pingUserMock = jest.fn();
    const streamAuctionMock = jest.fn();
    const clientMock = {pingUser: pingUserMock, streamAuction: streamAuctionMock};
    const test_auction_string = logParserTests[testCase].text;
    const item_list = logParserTests[testCase].itemList;
    const expected_auction_contents = logParserTests[testCase].expectedAuctionContents;
    const expected_auction_user = logParserTests[testCase].expectedAuctionUser;
    const expected_pings = logParserTests[testCase].expectedMatches;
    test(testCase, () => {
        logParser.parseLog(test_auction_string, item_list, 'GREEN', clientMock);
        expect(streamAuctionMock).toHaveBeenCalledTimes(1);
        expect(streamAuctionMock).toHaveBeenCalledWith(expected_auction_user, expected_auction_contents, "GREEN");
        expect(pingUserMock).toHaveBeenCalledTimes(expected_pings.length);
        expected_pings.forEach(ping => {
            expect(pingUserMock).toHaveBeenCalledWith(
                ...Object.values(ping).concat([test_auction_string]));
        })
    });
}
