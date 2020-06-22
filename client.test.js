jest.unmock("./client.js");
jest.mock('discord.js');
const discord = require("discord.js")
const client = require("./client.js");

const clientTests = {
    "properly formats a single item auction" : {
        userID: 1,
        auctionUser: "Crakle",
        item: "Chestplate of the Constant",
        price: 2000,
        server: "GREEN",
        auctionContents: "WTS - Chestplate of the Constant . 2k.",
        expectedMessage:
            "Crakle is currently selling Chestplate of the Constant for 2000pp on Project 1999 GREEN server.\n" +
            "***WTS - Chestplate of the Constant . 2k.***\n" +
            "To stop these messages, type \"!end watch: Chestplate of the Constant, GREEN\"."
    },
}

// RUN TESTS
for (let testCase in clientTests) {
    const user_id = clientTests[testCase].userID;
    const auction_user = clientTests[testCase].auctionUser;
    const item = clientTests[testCase].item;
    const price = clientTests[testCase].price;
    const server = clientTests[testCase].server;
    const auction_contents = clientTests[testCase].auctionContents;
    const expected_message = clientTests[testCase].expectedMessage;
    test(testCase, () => {
        client.pingUser(user_id, auction_user, item, price, server, auction_contents);
        expect(discord.Client.prototype.users.cache.get().send).toBeCalledWith(expected_message)
    });
}
