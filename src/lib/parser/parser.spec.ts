import {
	AuctionParser,
	AuctionTypes,
	auctionIncludesUnknownItem,
} from './parser';

const example_item_1 = 'RUBICITE BREASTPLATE';
const example_item_2 = 'RUSTY SHORT SWORD';

describe('AuctionParser', () => {
	let parser: AuctionParser;

	beforeEach(() => {
		parser = new AuctionParser();
	});

	describe('parseAuctionMessage', () => {
		const selling_variations = ['WTS', 'SELLING', 'WTSELL'];
		selling_variations.forEach((variation) => {
			it(`should correctly parse a selling message with ${variation}`, () => {
				const message = `${variation} ${example_item_1} 100k, ${example_item_2} 200k`;
				const result = parser.parseAuctionMessage(
					message.toUpperCase(),
				);
				expect(result.selling).toEqual([
					{ item: example_item_1, price: 100000 },
					{ item: example_item_2, price: 200000 },
				]);
				expect(result.buying).toEqual([]);
			});
		});

		const buying_variations = ['WTB', 'BUYING', 'WTBUY'];
		buying_variations.forEach((variation) => {
			it(`should correctly parse a buying message with ${variation}`, () => {
				const message = `${variation} ${example_item_1} 100k, ${example_item_2} 200k`;
				const result = parser.parseAuctionMessage(
					message.toUpperCase(),
				);
				expect(result.buying).toEqual([
					{ item: example_item_1, price: 100000 },
					{ item: example_item_2, price: 200000 },
				]);
				expect(result.selling).toEqual([]);
			});
		});

		// Add more tests here...
	});
});

describe('auctionIncludesUnknownItem', () => {
	it('should return true if the auction includes the unknown item and the watch type is WTS', () => {
		const auctionText = 'WTS unknownItem 100k';
		const item = 'unknownItem';
		const watchType = AuctionTypes.WTS;
		const result = auctionIncludesUnknownItem(auctionText, item, watchType);
		expect(result).toBe(true);
	});

	it('should return false if the auction does not include the unknown item', () => {
		const auctionText = 'WTS knownItem 100k';
		const item = 'unknownItem';
		const watchType = AuctionTypes.WTS;
		const result = auctionIncludesUnknownItem(auctionText, item, watchType);
		expect(result).toBe(false);
	});

	// Add more tests here...
});
