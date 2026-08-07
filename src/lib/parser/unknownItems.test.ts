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

	it('matches WTS watch for SELLING keyword before the item', () => {
		expect(
			auctionIncludesUnknownItem(
				'SELLING CUSTOM ROBE 100PP',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
		expect(
			auctionIncludesUnknownItem(
				'SELLING CUSTOM ROBE 100PP',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(false);
	});

	it('matches WTB watch for BUYING keyword before the item', () => {
		expect(
			auctionIncludesUnknownItem(
				'BUYING CUSTOM ROBE',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(true);
		expect(
			auctionIncludesUnknownItem(
				'BUYING CUSTOM ROBE',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(false);
	});

	it('defaults to selling when item appears before any keyword', () => {
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP WTB FOO',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP WTB FOO',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(false);
	});

	it('matches lowercase auction text with uppercase item', () => {
		expect(
			auctionIncludesUnknownItem(
				'wts custom robe 100pp',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
	});

	it('returns false when item is not present regardless of watch type', () => {
		expect(
			auctionIncludesUnknownItem(
				'WTS SOMETHING ELSE',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(false);
	});

	it('gives WTS watch the tie when neither keyword precedes the item', () => {
		// No keyword before item: both lastSellingIndex and lastBuyingIndex are -1.
		// WTS uses >= (true), WTB uses > (false).
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP',
				'CUSTOM ROBE',
				AuctionTypes.WTS,
			),
		).toBe(true);
		expect(
			auctionIncludesUnknownItem(
				'CUSTOM ROBE 500PP',
				'CUSTOM ROBE',
				AuctionTypes.WTB,
			),
		).toBe(false);
	});
});
