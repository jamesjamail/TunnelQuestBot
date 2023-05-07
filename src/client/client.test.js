jest.unmock('./client.js');
jest.mock('discord.js');
jest.mock('../db/db.js');
jest.mock('../utility/wikiHandler.js');

const wikiHandler = require('../utility/wikiHandler.js').default;

const fakeImageUrl = 'https://fake.com/image.jpg';
wikiHandler.fetchImageUrl = jest.fn().mockReturnValue({ catch: jest.fn().mockReturnValue(fakeImageUrl) });
wikiHandler.fetchWikiPricing = jest.fn().mockReturnValue('hist_pricing');

const client = require('./client.js');
const utils = require('../utility/utils.js');

const item1 = {
  name: 'Chestplate of the Constant',
  price: 2000,
  priceAbbr: '2k',
  server: 'GREEN',
};
const clientTests = {
  'properly formats a single item auction': {
    user: 'Misterwatcher',
    userId: 1,
    auctionUser: 'Crakle',
    item: item1.name,
    price: item1.price,
    server: item1.server,
    auctionContents: `WTS - ${item1.name} . ${item1.priceAbbr}.`,
    timestamp: 'some timestamp',
  },
};

// RUN TESTS
for (const testCase in clientTests) {
  const watch_id = clientTests[testCase].watchId;
  const { user } = clientTests[testCase];
  const user_id = clientTests[testCase].userId;
  const auction_user = clientTests[testCase].auctionUser;
  const { item } = clientTests[testCase];
  const { price } = clientTests[testCase];
  const { server } = clientTests[testCase];
  const auction_contents = clientTests[testCase].auctionContents;
  const { timestamp } = clientTests[testCase];
  test(testCase, async () => {
    await client.pingUser(
      watch_id,
      user,
      user_id,
      auction_user,
      item,
      price,
      server,
      auction_contents,
      timestamp,
    );
    const send_mock = client.bot.users.createDM().send.mock;
    // One call to the send() function
    expect(send_mock.calls.length).toEqual(1);
    // Containing one embed
    expect(send_mock.calls[0][0].embeds.length).toEqual(1);
    // Which has at least the item name as the title
    expect(send_mock.calls[0][0].embeds[0].data.title).toEqual(utils.formatCapitalCase(item));
    // Also containing one component
    expect(send_mock.calls[0][0].components.length).toEqual(1);
    // Which has an object with four subcomponents
    expect(send_mock.calls[0][0].components[0].components.length).toEqual(4);
    // They should have labels: 💤 / ❌ / 🔕 / ♻️
    expect(send_mock.calls[0][0].components[0].components[0].data.label).toEqual('💤');
    expect(send_mock.calls[0][0].components[0].components[1].data.label).toEqual('❌');
    expect(send_mock.calls[0][0].components[0].components[2].data.label).toEqual('🔕');
    expect(send_mock.calls[0][0].components[0].components[3].data.label).toEqual('♻️');
  });
}
