jest.unmock("discord.js");
jest.mock("./wikiHandler.js");

const wikiHandler = require("./wikiHandler.js").default;
const wikiHandlerTests = {
  "properly formats a single item auction": {
    auctionUser: "Crakle",
    auctionContents: "WTS - Chestplate of the Constant . 2k.",
    expectedFields: {
      title: "**[ WTS ]**   Crakle",
      description: "```WTS - Chestplate of the Constant . 2k.```",
      fields: [
        {
          inline: true,
          name: "2k",
          value:
            "[Chestplate of the Constant](https://wiki.project1999.com/Chestplate_of_the_Constant '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
      ],
    },
  },
  "properly formats an auction with multiple items": {
    auctionUser: "Stashboxx",
    auctionContents:
      "wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p",
    expectedFields: {
      title: "**[ WTB / WTS ]**   Stashboxx",
      description:
        "```wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p```",
      fields: [
        {
          inline: true,
          name: "No Price Listed",
          value:
            "[Allure](https://wiki.project1999.com/Allure '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
        {
          inline: true,
          name: "1k",
          value:
            "[Paralyzing Earth](https://wiki.project1999.com/Paralyzing_Earth '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
        {
          inline: true,
          name: "1.2k",
          value:
            "[Blanket of Forgetfulness](https://wiki.project1999.com/Blanket_of_Forgetfulness '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
        {
          inline: true,
          name: "5.1k",
          value:
            "[Shiftless Deeds](https://wiki.project1999.com/Shiftless_Deeds '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
        {
          inline: true,
          name: "40pp",
          value:
            "[Tepid Deeds](https://wiki.project1999.com/Tepid_Deeds '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
      ],
    },
  },
  "properly formats an auction with no items": {
    auctionUser: "Someone",
    auctionContents: "I am new to auc and what is this",
    expectedFields: {
      title: "**[ --- ]**   Someone",
      description: "```I am new to auc and what is this```",
      fields: [],
    },
  },
  "properly formats an item that is capitalized incorrectly": {
    auctionUser: "Crakle",
    auctionContents: "WTS - Chestplate of the cONstant . 2k.",
    expectedFields: {
      title: "**[ WTS ]**   Crakle",
      description: "```WTS - Chestplate of the cONstant . 2k.```",
      fields: [
        {
          inline: true,
          name: "2k",
          value:
            "[Chestplate of the Constant](https://wiki.project1999.com/Chestplate_of_the_Constant '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
      ],
    },
  },
  "doesn't match partial items": {
    auctionUser: "Berbank",
    auctionContents: "WTS Golden Amber Earring 500p, Jasper Gold Earring 300p",
    expectedFields: {
      title: "**[ WTS ]**   Berbank",
      description:
        "```WTS Golden Amber Earring 500p, Jasper Gold Earring 300p```",
      fields: [
        {
          inline: true,
          name: "500pp",
          value:
            "[Golden Amber Earring](https://wiki.project1999.com/Golden_Amber_Earring '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
        {
          inline: true,
          name: "300pp",
          value:
            "[Jasper Gold Earring](https://wiki.project1999.com/Jasper_Gold_Earring '30 day average: 1 ± 2\n90 day average: 2 ± 3')",
        },
      ],
    },
  },
};

// RUN TESTS
for (const testCase in wikiHandlerTests) {
  const auction_user = wikiHandlerTests[testCase].auctionUser;
  const auction_contents = wikiHandlerTests[testCase].auctionContents;
  const expected_fields = wikiHandlerTests[testCase].expectedFields;
  test(testCase, () => {
    return wikiHandler.fetchAndFormatAuctionData(auction_user, auction_contents, "GREEN")
      .then((auc_data) => {
        for (const field in expected_fields) {
          expect(auc_data.data[field]).toEqual(expected_fields[field]);
        }
      });
  });
}
