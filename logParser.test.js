const {parseLog} = require("./logParser.js");

/* Format for test data:
    ["AUCTION_STRING",
     [{items.name AS item_name, user_id, users.name AS user_name, price, server}]],
*/
const logParserTest = [
    [
        "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p'",
        new Set([
            {item_name: 'SHIFTLESS DEEDS', user_id: '1234', user_name: 'testuser', price: 5200, server: 'GREEN'},
            {item_name: 'TEPID DEEDS', user_id: '5678', user_name: 'user2', price: 20, server: 'GREEN'}
        ]),
        [
            {
                userName: 'testuser',
                seller: 'Stashboxx',
                itemName: 'SHIFTLESS DEEDS',
                sellingPrice: 5100,
                server: 'GREEN'
            }
        ]
    ],
    [
        "[Sun May 17 09:05:20 2020] Crakle auctions, 'WTS - Chestplate of the Constant . 2k.'",
        new Set([
            {item_name: 'CHESTPLATE OF THE CONSTANT', user_id: '1234', user_name: 'testuser', price: 1000, server: 'GREEN'}
        ]),
        []
    ]
];

// RUN TESTS
logParserTest.forEach(testCase => {
    const pingUserMock = jest.fn();
    const streamAuctionMock = jest.fn();
    const clientMock = {pingUser: pingUserMock, streamAuction: streamAuctionMock};
    const test_auction_string = testCase[0];
    const item_list = testCase[1];
    const expected_pings = testCase[2];
    test("properly parses a log line", () => {
        parseLog(test_auction_string, item_list, 'GREEN', clientMock);
        expect(streamAuctionMock).toHaveBeenCalledTimes(1);
        expect(streamAuctionMock).toHaveBeenCalledWith(test_auction_string, "GREEN");
        expect(pingUserMock).toHaveBeenCalledTimes(expected_pings.length);
        expected_pings.forEach(ping => {
            expect(pingUserMock).toHaveBeenCalledWith(
                ...Object.values(ping).concat([test_auction_string]));
        })
    });
});
