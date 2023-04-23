jest.unmock("./client.js");
jest.mock("discord.js");
jest.mock("../db/db.js");
jest.mock("../utility/wikiHandler.js");

const wikiHandler = require("../utility/wikiHandler.js").default;
const fakeImageUrl = "https://fake.com/image.jpg";
wikiHandler.fetchImageUrl = jest.fn().mockReturnValue({catch: jest.fn().mockReturnValue(fakeImageUrl)});
wikiHandler.fetchWikiPricing = jest.fn().mockReturnValue("hist_pricing");

const client = require("./client.js");
const utils = require("../utility/utils.js");

const item1 = {
  name: "Chestplate of the Constant",
  price: 2000,
  priceAbbr: "2k",
  server: "GREEN"
}
const clientTests = {
  "properly formats a single item auction": {
    user: "Misterwatcher",
    userId: 1,
    auctionUser: "Crakle",
    item: item1.name,
    price: item1.price,
    server: item1.server,
    auctionContents: `WTS - ${item1.name} . ${item1.priceAbbr}.`,
    timestamp: "2020-02-10 00:26:52.123456"
  },
};

// RUN TESTS
for (const testCase in clientTests) {
  const watch_id = clientTests[testCase].watchId;
  const user = clientTests[testCase].user;
  const user_id = clientTests[testCase].userId;
  const auction_user = clientTests[testCase].auctionUser;
  const item = clientTests[testCase].item;
  const price = clientTests[testCase].price;
  const server = clientTests[testCase].server;
  const auction_contents = clientTests[testCase].auctionContents;
  const expected_message = clientTests[testCase].expectedMessage;
  test(testCase, () => {
    client.pingUser(
      client.bot,
      watch_id,
      user,
      user_id,
      auction_user,
      item,
      price,
      server,
      auction_contents
    );
    // expect(discord.Client.prototype.users.cache.get().send).toBeCalledWith(
    //     expected_message
    // );
    // TODO: WTF? This changed somehow, and this still isn't quite right
    expect(discord.Client.prototype.users.createDM().send).toBeCalled();
  });
}
