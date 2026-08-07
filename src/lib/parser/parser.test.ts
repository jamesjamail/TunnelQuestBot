import { describe, it, expect, beforeAll } from 'vitest';
import { AuctionParser } from './parser';

const TEST_ITEMS = [
	'SICKLY GLOWING ORB',
	'FLAWLESS DIAMOND',
	'STRANGE OCHRE CLAY',
	'POLISHED BONE BRACELET',
	'WHITE HELLEBORE',
	'FLOWING BLACK SILK SASH',
	'FBSS',
	'CLOAK OF FLAMES',
	'RUBICITE BREASTPLATE',
	'SHORT SWORD OF THE YKESHA',
	'10 DOSE BLOOD OF THE WOLF',
	'GOLDEN EARRING',
	'MITHRIL BREASTPLATE',
];

let parser: AuctionParser;

beforeAll(() => {
	parser = new AuctionParser(TEST_ITEMS);
});

function parse(msg: string) {
	return parser.parseAuctionMessage(msg.toUpperCase());
}

describe('WTB/WTS separation', () => {
	it('separates WTS and WTB items in a mixed auction', () => {
		const result = parse(
			'WTS Sickly Glowing Orb 3.5k WTB Flawless Diamond',
		);
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('SICKLY GLOWING ORB');
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('FLAWLESS DIAMOND');
	});

	it('handles WTB first then WTS', () => {
		const result = parse(
			'WTB Flawless Diamond WTS Sickly Glowing Orb 3.5k',
		);
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('FLAWLESS DIAMOND');
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('SICKLY GLOWING ORB');
	});

	it('handles multiple items under each section', () => {
		const result = parse(
			'WTS Cloak of Flames 50k Rubicite Breastplate 10k WTB Golden Earring Mithril Breastplate',
		);
		expect(result.selling).toHaveLength(2);
		expect(result.selling[0].item).toBe('CLOAK OF FLAMES');
		expect(result.selling[1].item).toBe('RUBICITE BREASTPLATE');
		expect(result.buying).toHaveLength(2);
		expect(result.buying[0].item).toBe('GOLDEN EARRING');
		expect(result.buying[1].item).toBe('MITHRIL BREASTPLATE');
	});

	it('defaults to WTS when no keyword is present', () => {
		const result = parse('Sickly Glowing Orb 500pp');
		expect(result.selling).toHaveLength(1);
		expect(result.buying).toHaveLength(0);
	});

	it('defaults to WTB when only WTB is present', () => {
		const result = parse('WTB Sickly Glowing Orb Flawless Diamond');
		expect(result.buying).toHaveLength(2);
		expect(result.selling).toHaveLength(0);
	});
});

describe('price parsing with suffixes', () => {
	it('parses k suffix', () => {
		const result = parse('WTS Sickly Glowing Orb 3.5k');
		expect(result.selling[0].price).toBe(3500);
	});

	it('parses pp suffix', () => {
		const result = parse('WTS Sickly Glowing Orb 500pp');
		expect(result.selling[0].price).toBe(500);
	});

	it('parses p suffix', () => {
		const result = parse('WTS Strange Ochre Clay 50p');
		expect(result.selling[0].price).toBe(50);
	});

	it('parses plat suffix', () => {
		const result = parse('WTS Sickly Glowing Orb 500plat');
		expect(result.selling[0].price).toBe(500);
	});

	it('parses platinum suffix', () => {
		const result = parse('WTS Sickly Glowing Orb 500platinum');
		expect(result.selling[0].price).toBe(500);
	});

	it('parses m suffix for millions', () => {
		const result = parse('WTS Cloak of Flames 1m');
		expect(result.selling[0].price).toBe(1000000);
	});

	it('parses mil suffix for millions', () => {
		const result = parse('WTS Cloak of Flames 1.5mil');
		expect(result.selling[0].price).toBe(1500000);
	});

	it('parses comma-separated numbers', () => {
		const result = parse('WTS Cloak of Flames 10,000pp');
		expect(result.selling[0].price).toBe(10000);
	});

	it('parses price with space before suffix', () => {
		const result = parse('WTS Sickly Glowing Orb 500 pp');
		expect(result.selling[0].price).toBe(500);
	});

	it('parses bare number as fallback', () => {
		const result = parse('WTS Sickly Glowing Orb 500');
		expect(result.selling[0].price).toBe(500);
	});
});

describe('quantity patterns should NOT be prices', () => {
	it('does not treat x4 as a price', () => {
		const result = parse('WTB Flawless Diamond x4');
		expect(result.buying[0].price).toBeUndefined();
	});

	it('does not treat (x20) as a price when suffixed price present', () => {
		const result = parse('WTS White Hellebore (x20) 20p ea');
		expect(result.selling[0].price).toBe(20);
	});

	it('correctly parses price after quantity indicator', () => {
		const result = parse('WTS White Hellebore x20 20p ea');
		expect(result.selling[0].price).toBe(20);
	});

	it('does not misread quantity when price comes before it', () => {
		const result = parse('WTS White Hellebore 20p (x3)');
		expect(result.selling[0].price).toBe(20);
	});
});

describe('per-item (ea/each) detection', () => {
	it('detects ea after price', () => {
		const result = parse('WTS White Hellebore (x20) 20p ea');
		expect(result.selling[0].perItem).toBe(true);
	});

	it('detects each after price', () => {
		const result = parse('WTS White Hellebore 20pp each');
		expect(result.selling[0].perItem).toBe(true);
	});

	it('does not set perItem when ea is not present', () => {
		const result = parse('WTS Sickly Glowing Orb 3.5k');
		expect(result.selling[0].perItem).toBeUndefined();
	});
});

describe('real-world auction examples', () => {
	it('WTS Sickly Glowing Orb 3.5k WTB Flawless Diamond x4', () => {
		const result = parse(
			'WTS Sickly Glowing Orb 3.5k WTB Flawless Diamond x4',
		);
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('SICKLY GLOWING ORB');
		expect(result.selling[0].price).toBe(3500);
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('FLAWLESS DIAMOND');
		expect(result.buying[0].price).toBeUndefined();
	});

	it('WTS Strange Ochre Clay 50p Polished Bone Bracelet 25p White Hellebore (x20) 20p ea', () => {
		const result = parse(
			'WTS Strange Ochre Clay 50p Polished Bone Bracelet 25p White Hellebore (x20) 20p ea',
		);
		expect(result.selling).toHaveLength(3);
		expect(result.selling[0].item).toBe('STRANGE OCHRE CLAY');
		expect(result.selling[0].price).toBe(50);
		expect(result.selling[1].item).toBe('POLISHED BONE BRACELET');
		expect(result.selling[1].price).toBe(25);
		expect(result.selling[2].item).toBe('WHITE HELLEBORE');
		expect(result.selling[2].price).toBe(20);
		expect(result.selling[2].perItem).toBe(true);
	});

	it('WTS FBSS 1.5k, Flowing Black Silk Sash 500pp', () => {
		const result = parse('WTS FBSS 1.5k, Flowing Black Silk Sash 500pp');
		expect(result.selling).toHaveLength(2);
		expect(result.selling[0].price).toBe(1500);
		expect(result.selling[1].price).toBe(500);
	});

	it('handles WTT as WTS', () => {
		const result = parse('WTT Short Sword of the Ykesha');
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('SHORT SWORD OF THE YKESHA');
	});
});

describe('extended keyword recognition', () => {
	it('recognizes SELLING as a selling keyword', () => {
		const result = parse('SELLING Cloak of Flames 50k');
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('CLOAK OF FLAMES');
		expect(result.selling[0].price).toBe(50000);
		expect(result.buying).toHaveLength(0);
	});

	it('recognizes BUYING as a buying keyword', () => {
		const result = parse('BUYING Flawless Diamond');
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('FLAWLESS DIAMOND');
		expect(result.selling).toHaveLength(0);
	});

	it('recognizes WTSELL as selling', () => {
		const result = parse('WTSELL Rubicite Breastplate 10k');
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('RUBICITE BREASTPLATE');
		expect(result.selling[0].price).toBe(10000);
	});

	it('recognizes WTBUY as buying', () => {
		const result = parse('WTBUY Golden Earring');
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('GOLDEN EARRING');
	});

	it('splits across mixed keyword styles', () => {
		const result = parse('WTS Cloak of Flames 50k BUYING Golden Earring');
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('CLOAK OF FLAMES');
		expect(result.buying).toHaveLength(1);
		expect(result.buying[0].item).toBe('GOLDEN EARRING');
	});
});

describe('edge cases', () => {
	it('returns empty arrays for empty string', () => {
		expect(parse('')).toEqual({ buying: [], selling: [] });
	});

	it('returns empty arrays when no dictionary match', () => {
		expect(parse('WTS SOMETHING NOBODY HAS')).toEqual({
			buying: [],
			selling: [],
		});
	});

	it('returns empty arrays when message is only a keyword', () => {
		expect(parse('WTS')).toEqual({ buying: [], selling: [] });
	});

	it('produces two entries when the same item appears twice in one section', () => {
		const result = parse(
			'WTS Sickly Glowing Orb 500pp Sickly Glowing Orb 3.5k',
		);
		expect(result.selling).toHaveLength(2);
		expect(result.selling[0].item).toBe('SICKLY GLOWING ORB');
		expect(result.selling[0].price).toBe(500);
		expect(result.selling[1].item).toBe('SICKLY GLOWING ORB');
		expect(result.selling[1].price).toBe(3500);
	});

	it('respects a restricted dictionary in the constructor', () => {
		const restrictedParser = new AuctionParser(['CLOAK OF FLAMES']);
		const result = restrictedParser.parseAuctionMessage(
			'WTS CLOAK OF FLAMES 50K SICKLY GLOWING ORB 500PP',
		);
		expect(result.selling).toHaveLength(1);
		expect(result.selling[0].item).toBe('CLOAK OF FLAMES');
	});
});
