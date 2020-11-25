jest.unmock("./wikiHandler.js");
jest.unmock("discord.js");
const wikiHandler = require("./wikiHandler.js");

// Mock getWikiPricing for our tests
wikiHandler.getWikiPricing = jest.fn();
wikiHandler.getWikiPricing.mockReturnValue({
    "30": "1 ± 2",
    "90": "2 ± 3"
})

const wikiHandlerTests = {
    "properly formats a single item auction" : {
        auctionUser: "Crakle",
        auctionContents: "WTS - Chestplate of the Constant . 2k.",
        expectedFields: {
            "title": "Crakle (WTS)",
            "description": "```WTS - Chestplate of the Constant . 2k.```",
            "fields": [
                {
                    "inline": true,
                    "name": "2k",
                    "value": "[Chestplate of the Constant](http://wiki.project1999.com/Chestplate_of_the_Constant '30 day average: 1 ± 2\n90 day average: 2 ± 3')"}
            ],
        }
    },
    "properly formats an auction with multiple items": {
        auctionUser: "Stashboxx",
        auctionContents: "wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p",
        expectedFields: {
            "title": "Stashboxx (WTB / WTS)",
            "description": "```wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p```",
            "fields": [
                {
                    "inline": true,
                    "name": "No Price Listed",
                    "value": "[Allure](http://wiki.project1999.com/Allure '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                },
                {
                    "inline": true,
                    "name": "1k",
                    "value": "[Paralyzing Earth](http://wiki.project1999.com/Paralyzing_Earth '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                },
                {
                    "inline": true,
                    "name": "1.2k",
                    "value": "[Blanket of Forgetfulness](http://wiki.project1999.com/Blanket_of_Forgetfulness '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                },
                {
                    "inline": true,
                    "name": "5.1k",
                    "value": "[Shiftless Deeds](http://wiki.project1999.com/Shiftless_Deeds '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                },
                {
                    "inline": true,
                    "name": "40pp",
                    "value": "[Tepid Deeds](http://wiki.project1999.com/Tepid_Deeds '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                }
            ]
        }
    },
    "properly formats an auction with no items": {
        auctionUser: "Someone",
        auctionContents: "I am new to auc and what is this",
        expectedFields: {
            "title": "Someone (???)",
            "description": "```I am new to auc and what is this```",
            "fields": []
        }
    },
    "properly formats an item that is capitalized incorrectly" : {
        auctionUser: "Crakle",
        auctionContents: "WTS - Chestplate of the cONstant . 2k.",
        expectedFields: {
            "title": "Crakle (WTS)",
            "description": "```WTS - Chestplate of the cONstant . 2k.```",
            "fields": [
                {
                    "inline": true,
                    "name": "2k",
                    "value": "[Chestplate of the Constant](http://wiki.project1999.com/Chestplate_of_the_Constant '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                }
            ],
        }
    },
    "doesn't match partial items" : {
        auctionUser: "Berbank",
        auctionContents: "WTS Golden Amber Earring 500p, Jasper Gold Earring 300p",
        expectedFields: {
            "title": "Berbank (WTS)",
            "description": "```WTS Golden Amber Earring 500p, Jasper Gold Earring 300p```",
            "fields": [
                {
                    "inline": true,
                    "name": "500pp",
                    "value": "[Golden Amber Earring](http://wiki.project1999.com/Golden_Amber_Earring '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                },
                {
                    "inline": true,
                    "name": "300pp",
                    "value": "[Jasper Gold Earring](http://wiki.project1999.com/Jasper_Gold_Earring '30 day average: 1 ± 2\n90 day average: 2 ± 3')"
                }
            ],
        }
    },
}

// RUN TESTS
for (let testCase in wikiHandlerTests) {
    const auction_user = wikiHandlerTests[testCase].auctionUser;
    const auction_contents = wikiHandlerTests[testCase].auctionContents;
    const expected_fields = wikiHandlerTests[testCase].expectedFields;
    test(testCase, () => {
        return wikiHandler.fetchAndFormatAuctionData(auction_user, auction_contents, 'GREEN')
        .then(auc_data => {
            for (let field in expected_fields) {
                expect(auc_data[field]).toEqual(expected_fields[field])
            }
        });
    });
}
