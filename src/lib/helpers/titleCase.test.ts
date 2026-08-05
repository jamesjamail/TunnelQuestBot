import { describe, it, expect } from 'vitest';
import { toTitleCase } from './titleCase';

describe('toTitleCase', () => {
	it('preserves hyphens in item names', () => {
		expect(toTitleCase('BEAR-HIDE BELT')).toBe('Bear-Hide Belt');
	});

	it('title-cases normal item names (regression guard)', () => {
		expect(toTitleCase('CLOAK OF FLAMES')).toBe('Cloak of Flames');
	});

	it('title-cases names with "the" (regression guard)', () => {
		expect(toTitleCase('RING OF THE ANCIENTS')).toBe(
			'Ring of the Ancients',
		);
	});
});
