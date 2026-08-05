import { describe, it, expect } from 'vitest';
import { auctionIncludesUnknownItem, AuctionTypes } from './parser';

describe('auctionIncludesUnknownItem', () => {
	it('matches WTS watch when the last keyword before the item is WTS', () => {
		expect(
			auctionIncludesUnknownItem(
				'WTS FOO WTB BAR WTS CUSTOM ROBE 100PP',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
	});

	it('matches WTB watch when the last keyword before the item is WTB', () => {
		expect(
			auctionIncludesUnknownItem(
				'WTB FOO WTS BAR WTB CUSTOM ROBE',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(true);
	});

	it('does not match WTB watch when no keyword precedes the item', () => {
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(false);
	});

	it('matches WTS watch when no keyword precedes the item (regression guard)', () => {
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
	});

	it('matches WTB watch when WTB keyword precedes the item (regression guard)', () => {
		expect(
			auctionIncludesUnknownItem(
				'WTB CUSTOM ROBE',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(true);
	});

	it('returns false when the item is absent (regression guard)', () => {
		expect(
			auctionIncludesUnknownItem(
				'WTS SOMETHING ELSE',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(false);
	});
});
