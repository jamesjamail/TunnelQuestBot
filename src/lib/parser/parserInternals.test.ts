import { describe, it, expect } from 'vitest';
import { preprocessMessage, composeRanges, parsePrice } from './parser';

describe('preprocessMessage', () => {
	it('replaces WTT with WTS', () => {
		expect(preprocessMessage('WTT CLOAK OF FLAMES')).toBe(
			'WTS CLOAK OF FLAMES',
		);
	});

	it('replaces WTT case-insensitively while preserving surrounding text case', () => {
		expect(preprocessMessage('wtt cloak')).toBe('WTS cloak');
	});

	it('does not match WTT inside a word', () => {
		expect(preprocessMessage('WATTLE')).toBe('WATTLE');
	});

	it('strips ASKING', () => {
		expect(preprocessMessage('WTS ITEM ASKING 500PP')).toBe(
			'WTS ITEM  500PP',
		);
	});

	it('strips OBO', () => {
		expect(preprocessMessage('WTS ITEM OBO')).toBe('WTS ITEM');
	});

	it('strips OFFERS', () => {
		expect(preprocessMessage('WTS ITEM OFFERS')).toBe('WTS ITEM');
	});

	it('strips OR BEST OFFER', () => {
		expect(preprocessMessage('WTS ITEM OR BEST OFFER')).toBe('WTS ITEM');
	});

	it('strips TRADE', () => {
		expect(preprocessMessage('WTS ITEM TRADE')).toBe('WTS ITEM');
	});

	it('strips OR TRADE', () => {
		expect(preprocessMessage('WTS ITEM OR TRADE')).toBe('WTS ITEM');
	});

	it('strips PST', () => {
		expect(preprocessMessage('WTS ITEM PST')).toBe('WTS ITEM');
	});

	it('strips exclamation marks', () => {
		expect(preprocessMessage('WTS ITEM!')).toBe('WTS ITEM');
	});

	it('converts /WTT prefix via WTT replacement then leaves /WTS', () => {
		// WTT→WTS runs before the /WTT strip branch, so /WTT becomes /WTS
		expect(preprocessMessage('/WTT ITEM')).toBe('/WTS ITEM');
	});

	it('preserves EA for per-item detection', () => {
		expect(preprocessMessage('20P EA')).toBe('20P EA');
	});

	it('preserves EACH for per-item detection', () => {
		expect(preprocessMessage('20PP EACH')).toBe('20PP EACH');
	});

	it('trims leading and trailing whitespace', () => {
		expect(preprocessMessage('  WTS ITEM  ')).toBe('WTS ITEM');
	});
});

describe('composeRanges', () => {
	it('returns an empty array for empty input', () => {
		expect(composeRanges([])).toEqual([]);
	});

	it('round-trips a single range unchanged', () => {
		expect(composeRanges([{ start: 5, end: 10 }])).toEqual([
			{ start: 5, end: 10 },
		]);
	});

	it('returns two non-overlapping ranges ascending by start', () => {
		expect(
			composeRanges([
				{ start: 20, end: 30 },
				{ start: 5, end: 10 },
			]),
		).toEqual([
			{ start: 5, end: 10 },
			{ start: 20, end: 30 },
		]);
	});

	it('merges two overlapping ranges into one spanning the union', () => {
		expect(
			composeRanges([
				{ start: 0, end: 25 },
				{ start: 10, end: 30 },
			]),
		).toEqual([{ start: 0, end: 30 }]);
	});

	it('collapses a range fully contained inside another', () => {
		expect(
			composeRanges([
				{ start: 0, end: 30 },
				{ start: 10, end: 20 },
			]),
		).toEqual([{ start: 0, end: 30 }]);
	});

	it('merges overlapping pair and keeps separate third range', () => {
		expect(
			composeRanges([
				{ start: 0, end: 25 },
				{ start: 10, end: 30 },
				{ start: 40, end: 50 },
			]),
		).toEqual([
			{ start: 0, end: 30 },
			{ start: 40, end: 50 },
		]);
	});
});

describe('parsePrice', () => {
	it('parses k suffix', () => {
		expect(parsePrice('3.5k')).toEqual({ price: 3500, perItem: false });
	});

	it('parses pp suffix', () => {
		expect(parsePrice('500pp')).toEqual({ price: 500, perItem: false });
	});

	it('parses p suffix', () => {
		expect(parsePrice('50p')).toEqual({ price: 50, perItem: false });
	});

	it('parses plat suffix', () => {
		expect(parsePrice('500plat')).toEqual({ price: 500, perItem: false });
	});

	it('parses platinum suffix', () => {
		expect(parsePrice('500platinum')).toEqual({
			price: 500,
			perItem: false,
		});
	});

	it('parses m suffix', () => {
		expect(parsePrice('1m')).toEqual({ price: 1000000, perItem: false });
	});

	it('parses mil suffix', () => {
		expect(parsePrice('1.5mil')).toEqual({
			price: 1500000,
			perItem: false,
		});
	});

	it('strips commas from numbers', () => {
		expect(parsePrice('10,000pp')).toEqual({
			price: 10000,
			perItem: false,
		});
	});

	it('parses price with space before suffix', () => {
		expect(parsePrice('500 pp')).toEqual({ price: 500, perItem: false });
	});

	it('parses bare number via fallback', () => {
		expect(parsePrice('500')).toEqual({ price: 500, perItem: false });
	});

	it('does not treat x4 as a price', () => {
		expect(parsePrice('x4')).toEqual({
			price: undefined,
			perItem: false,
		});
	});

	it('returns undefined price for empty string', () => {
		expect(parsePrice('')).toEqual({ price: undefined, perItem: false });
	});

	it('prefers last suffixed match over quantity', () => {
		expect(parsePrice('(x20) 20p')).toEqual({ price: 20, perItem: false });
	});

	it('prefers suffixed match over earlier bare number', () => {
		expect(parsePrice('4 items 500pp')).toEqual({
			price: 500,
			perItem: false,
		});
	});

	it('detects perItem for ea', () => {
		expect(parsePrice('20p ea')).toEqual({ price: 20, perItem: true });
	});

	it('detects perItem for each', () => {
		expect(parsePrice('20pp each')).toEqual({ price: 20, perItem: true });
	});

	it('does not set perItem when ea is part of another word', () => {
		expect(parsePrice('20p eagle')).toEqual({
			price: 20,
			perItem: false,
		});
	});
});
