import { describe, it, expect } from 'vitest';
import { consolidatedItems } from '../gameData/consolidatedItems';
import { getWikiUrlFromItem } from './wikiLinks';

const KNOWN_ITEM = 'FLOWING BLACK SILK SASH';
const KNOWN_SLUG = consolidatedItems[KNOWN_ITEM];

describe('getWikiUrlFromItem', () => {
	it('returns wiki URL with slug for known items', () => {
		expect(getWikiUrlFromItem(KNOWN_ITEM)).toBe(
			`https://wiki.example.com${KNOWN_SLUG}`,
		);
	});

	it('returns null for unknown items', () => {
		expect(getWikiUrlFromItem('SOME MADE UP THING')).toBeNull();
	});

	it('resolves lowercase input', () => {
		expect(getWikiUrlFromItem('flowing black silk sash')).toBe(
			`https://wiki.example.com${KNOWN_SLUG}`,
		);
	});

	it('returns null for undefined input', () => {
		expect(getWikiUrlFromItem(undefined as unknown as string)).toBeNull();
	});
});
