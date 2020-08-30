jest.unmock("./db.js");
jest.mock('pg');
const pg = require("pg")
const db = require("./db.js");

// This is a pretty lame test, just setting up the framework
const getWatchesTests = {
    "getWatches causes a database query" : {},
}

// RUN TESTS
for (let testCase in getWatchesTests) {
    test(testCase, () => {
        const callback = jest.fn();
        let queryMock = pg.Client.prototype.query;
        db.getWatches(callback);
        expect(queryMock).toHaveBeenCalledTimes(1);
    });
}
