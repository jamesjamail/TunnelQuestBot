const {fetchAndFormatAuctionData} = require("./wikiHandler.js");

const wikiHandlerTest = [
    {
        "auctionUser": "Crakle",
        "auctionContents": "WTS - Chestplate of the Constant . 2k.",
        "expectedMessage": new RegExp(
            "^\\[\\*\\*Crakle\\*\\*\\] \\*\\*WTS\\*\\*:\n" +
            "`WTS - Chestplate of the Constant . 2k.`\n" +
            "<http:\/\/wiki.project1999.com\/Chestplate_of_the_Constant>      \\*\\*2000pp\\*\\*         .*$"
        )
    },
    {
        "auctionUser": "Stashboxx",
        "auctionContents": "wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p",
        "expectedMessage": new RegExp(
            "^\\[\\*\\*Stashboxx\\*\\*\\] \\*\\*WTB / WTS\\*\\*:\n" +
            "`wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p`\n" +
            "<http://wiki.project1999.com/Allure>                                                                                                                                                                       \\[.*\n" +
            "<http://wiki.project1999.com/Paralyzing_Earth>                                                      \\*\\*1000pp\\*\\*         \\[.*\n" +
            "<http://wiki.project1999.com/Blanket_of_Forgetfulness>      \\*\\*1200pp\\*\\*         \\[.*\n" +
            "<http://wiki.project1999.com/Shiftless_Deeds>                                                           \\*\\*5100pp\\*\\*         \\[.*\n" +
            "<http://wiki.project1999.com/Tepid_Deeds>                                                                           \\*\\*40pp\\*\\*                       \\[.*$"
        )
    },
    {
        "auctionUser": "Someone",
        "auctionContents": "I am new to auc and what is this",
        "expectedMessage": new RegExp(
            "^\\[\\*\\*Someone\\*\\*\\] \\*\\*\\?\\?\\?\\*\\*:\n" +
            "`I am new to auc and what is this`$"
        )
    }
]

// RUN TESTS
wikiHandlerTest.forEach(testCase => {
    const auction_user = testCase["auctionUser"];
    const auction_contents = testCase["auctionContents"];
    const expected_message = testCase["expectedMessage"];
    test("properly formats an auction message", () => {
        return fetchAndFormatAuctionData(auction_user, auction_contents, 'GREEN')
        .then(auc_data => {
            expect(auc_data).toEqual(expect.stringMatching(expected_message));
        });
    });
});