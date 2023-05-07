const wikiHandler = jest.requireActual("../wikiHandler.js");
wikiHandler.default.getWikiPricing = jest.fn().mockReturnValue({
    30: "1 ± 2",
    90: "2 ± 3",
})

module.exports = wikiHandler;
