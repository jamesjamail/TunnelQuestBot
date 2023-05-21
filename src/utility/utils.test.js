const utils = require("./utils")

const TEST_DATA = {
  "ITEM1": "/Item1",
  "ITEM'2": "/Item2",
  "ITEM`3": "/Item3",
}

const EXPECTED_RESULT = {
  "ITEM1": "/Item1",
  "ITEM2": "/Item2",
  "ITEM'2": "/Item2",
  "ITEM`2": "/Item2",
  "ITEM3": "/Item3",
  "ITEM'3": "/Item3",
  "ITEM`3": "/Item3",
}

test('Should duplicate items with apostrophe-likes', () => {
  const fixed_items = utils.fixApostrophes(TEST_DATA);
  expect(fixed_items).toEqual(EXPECTED_RESULT);
})
