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

	it('capitalizes a leading preposition', () => {
		expect(toTitleCase('OF THE WOLF')).toBe('Of the Wolf');
	});

	it('title-cases dose item names', () => {
		expect(toTitleCase('10 DOSE BLOOD OF THE WOLF')).toBe(
			'10 Dose Blood of the Wolf',
		);
	});

	it('returns empty string for empty input', () => {
		expect(toTitleCase('')).toBe('');
	});

	it('trims padded input', () => {
		expect(toTitleCase('  padded  ')).toBe('Padded');
	});

	it('lowercases every preposition after the first token', () => {
		const prepositions = [
			'of',
			'in',
			'to',
			'for',
			'with',
			'on',
			'at',
			'from',
			'by',
			'about',
			'as',
			'the',
			'a',
			'an',
		];

		for (const preposition of prepositions) {
			const input = `ALPHA ${preposition.toUpperCase()} BETA`;
			expect(toTitleCase(input)).toBe(`Alpha ${preposition} Beta`);
		}
	});
});
