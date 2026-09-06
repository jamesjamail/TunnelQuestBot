import { describe, it, expect } from 'vitest';
import inGameItemNamesRaw from './items.json';
import inGameSpellNamesRaw from './spells.json';
import inGameAliasesRaw from './aliases.json';
import {
	consolidatedItems,
	consolidatedItemsAndAliases,
	resolveCanonicalItemName,
} from './consolidatedItems';

describe('consolidatedItems data shape', () => {
	it('includes keys from items.json and spells.json', () => {
		expect(consolidatedItems['FLOWING BLACK SILK SASH']).toBe(
			inGameItemNamesRaw['FLOWING BLACK SILK SASH'],
		);
		expect(consolidatedItems["AANYA'S ANIMATION"]).toBe(
			inGameSpellNamesRaw["AANYA'S ANIMATION"],
		);
	});

	it('extends consolidatedItems with aliases such as FBSS', () => {
		for (const key of Object.keys(consolidatedItems)) {
			expect(consolidatedItemsAndAliases[key]).toBe(
				consolidatedItems[key],
			);
		}
		expect(consolidatedItemsAndAliases.FBSS).toBe(inGameAliasesRaw.FBSS);
		expect(consolidatedItems.FBSS).toBeUndefined();
	});

	it('maps apostrophe and backtick variants to the same wiki path', () => {
		const apostropheKey = "10 DOSE ANT'S POTION";
		const backtickKey = '10 DOSE ANT`S POTION';
		expect(consolidatedItems[apostropheKey]).toBeDefined();
		expect(consolidatedItems[backtickKey]).toBe(
			consolidatedItems[apostropheKey],
		);
	});

	it('stores wiki paths starting with / for every entry', () => {
		for (const wikiPath of Object.values(consolidatedItems)) {
			expect(wikiPath.startsWith('/')).toBe(true);
		}
	});
});

describe('resolveCanonicalItemName', () => {
	it('resolves lowercase aliases to canonical names', () => {
		expect(resolveCanonicalItemName('fbss')).toBe(
			'FLOWING BLACK SILK SASH',
		);
	});

	it('returns unknown strings uppercased unchanged', () => {
		expect(resolveCanonicalItemName('SOME MADE UP THING')).toBe(
			'SOME MADE UP THING',
		);
	});
});
