const {fetchAndFormatAuctionData} = require("./wikiHandler.js");

// TODO: Fix these tests to not use real wiki data (which will change)
const wikiHandlerTests = {
    "properly formats a single item auction" : {
        "auctionUser": "Crakle",
        "auctionContents": "WTS - Chestplate of the Constant . 2k.",
        "expectedFields": {
            "title": "Crakle (WTS)",
            "description": "`WTS - Chestplate of the Constant . 2k.`",
            "fields": [
                {
                    "inline": true,
                    "name": "2000",
                    "value": "[Chestplate of the Constant](http://wiki.project1999.com/Chestplate_of_the_Constant '30 day average: 1186 ± 2863\n90 day average: 1162 ± 2784')"}
            ],
        }
    },
    "properly formats an auction with multiple items": {
        "auctionUser": "Stashboxx",
        "auctionContents": "wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p",
        "expectedFields": {
            "title": "Stashboxx (WTB / WTS)",
            "description": "`wts Spell: Allure ..Spell: Paralyzing Earth1k WTB ..Spell: Blanket of Forgetfulness1.2k...WTSSpell: Shiftless Deeds...5.1k ...Spell: Tepid Deeds40p`",
            "fields": [
                {
                    "inline": true,
                    "name": "No Price Listed",
                    "value": "[Allure](http://wiki.project1999.com/Allure '30 day average: 1486 ± 717\n90 day average: 2412 ± 926')"
                },
                {
                    "inline": true,
                    "name": "1000",
                    "value": "[Paralyzing Earth](http://wiki.project1999.com/Paralyzing_Earth '30 day average: 381 ± 139\n90 day average: 478 ± 451')"
                },
                {
                    "inline": true,
                    "name": "1200",
                    "value": "[Blanket of Forgetfulness](http://wiki.project1999.com/Blanket_of_Forgetfulness '30 day average: 648 ± 628\n90 day average: 736 ± 472')"
                },
                {
                    "inline": true,
                    "name": "5100",
                    "value": "[Shiftless Deeds](http://wiki.project1999.com/Shiftless_Deeds '30 day average: 1014 ± 136\n90 day average: 990 ± 267')"
                },
                {
                    "inline": true,
                    "name": "40",
                    "value": "[Tepid Deeds](http://wiki.project1999.com/Tepid_Deeds '30 day average: 20 ± 10\n90 day average: 22 ± 9')"
                }
            ]
        }
    },
    "properly formats an auction with no items": {
        "auctionUser": "Someone",
        "auctionContents": "I am new to auc and what is this",
        "expectedFields": {
            "title": "Someone (???)",
            "description": "`I am new to auc and what is this`",
            "fields": []
        }
    }
}

// RUN TESTS
for (let testCase in wikiHandlerTests) {
    const auction_user = wikiHandlerTests[testCase]["auctionUser"];
    const auction_contents = wikiHandlerTests[testCase]["auctionContents"];
    const expected_fields = wikiHandlerTests[testCase]["expectedFields"];
    test(testCase, () => {
        return fetchAndFormatAuctionData(auction_user, auction_contents, 'GREEN')
        .then(auc_data => {
            for (let field in expected_fields) {
                expect(auc_data[field]).toEqual(expected_fields[field])
            }
        });
    });
}