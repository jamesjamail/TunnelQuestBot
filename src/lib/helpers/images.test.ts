import { describe, it, expect } from 'vitest';
import { consolidatedItems } from '../gameData/consolidatedItems';
import { getImageUrlForItem } from './images';

const KNOWN_ITEM = 'FLOWING BLACK SILK SASH';
const KNOWN_SLUG = consolidatedItems[KNOWN_ITEM];

describe('getImageUrlForItem', () => {
	it('returns bucket URL with slug and png extension for known items', () => {
		expect(getImageUrlForItem(KNOWN_ITEM)).toBe(
			`https://img.example.com/${KNOWN_SLUG}.png`,
		);
	});

	it('returns null for unknown items', () => {
		expect(getImageUrlForItem('SOME MADE UP THING')).toBeNull();
	});

	it('resolves lowercase input', () => {
		expect(getImageUrlForItem('flowing black silk sash')).toBe(
			`https://img.example.com/${KNOWN_SLUG}.png`,
		);
	});

	it('returns null for undefined input', () => {
		expect(getImageUrlForItem(undefined as unknown as string)).toBeNull();
	});

	it('resolves alias item names such as FBSS', () => {
		expect(getImageUrlForItem('FBSS')).toBe(
			`https://img.example.com/${KNOWN_SLUG}.png`,
		);
	});
});
