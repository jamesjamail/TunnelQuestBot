import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '../../prisma/client';
import {
	isSnoozed,
	formatServerFromEnum,
	formatPriceNumberToReadableString,
	isKnownItem,
	normalizeStoredWatchItemName,
} from './watches';

describe('isSnoozed', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns false for null', () => {
		expect(isSnoozed(null)).toBe(false);
	});

	it('returns true for a timestamp one hour in the future', () => {
		const oneHourLater = new Date('2026-01-01T01:00:00.000Z');
		expect(isSnoozed(oneHourLater)).toBe(true);
	});

	it('returns false for a timestamp one hour in the past', () => {
		const oneHourAgo = new Date('2025-12-31T23:00:00.000Z');
		expect(isSnoozed(oneHourAgo)).toBe(false);
	});

	it('accepts an ISO string cast as Date for a future time', () => {
		const futureIso = '2026-01-01T01:00:00.000Z' as unknown as Date;
		expect(isSnoozed(futureIso)).toBe(true);
	});
});

describe('formatServerFromEnum', () => {
	it('formats BLUE server', () => {
		expect(formatServerFromEnum(Server.BLUE)).toBe(
			'Project 1999 blue server',
		);
	});

	it('formats GREEN server', () => {
		expect(formatServerFromEnum(Server.GREEN)).toBe(
			'Project 1999 green server',
		);
	});

	it('formats RED server', () => {
		expect(formatServerFromEnum(Server.RED)).toBe(
			'Project 1999 red server',
		);
	});
});

describe('formatPriceNumberToReadableString', () => {
	it('returns dash unchanged', () => {
		expect(formatPriceNumberToReadableString('-')).toBe('-');
	});

	it('formats zero', () => {
		expect(formatPriceNumberToReadableString(0)).toBe('0pp');
	});

	it('formats values under 1000 with pp suffix', () => {
		expect(formatPriceNumberToReadableString(999)).toBe('999pp');
	});

	it('formats exact thousands with k suffix', () => {
		expect(formatPriceNumberToReadableString(1000)).toBe('1k');
	});

	it('formats fractional thousands with k suffix', () => {
		expect(formatPriceNumberToReadableString(1500)).toBe('1.5k');
	});

	it('falls back to comma formatting when k rounding does not match', () => {
		expect(formatPriceNumberToReadableString(1234)).toBe('1,234pp');
	});

	it('uses k format for large round thousands', () => {
		expect(formatPriceNumberToReadableString(1000000)).toBe('1000k');
	});
});

describe('isKnownItem', () => {
	it('recognizes alias keys', () => {
		expect(isKnownItem('FBSS')).toBe(true);
	});

	it('recognizes canonical names case-insensitively', () => {
		expect(isKnownItem('flowing black silk sash')).toBe(true);
	});

	it('returns false for unknown items', () => {
		expect(isKnownItem('SOME MADE UP THING')).toBe(false);
	});
});

describe('normalizeStoredWatchItemName', () => {
	it('stores aliases under their canonical item name', () => {
		expect(normalizeStoredWatchItemName('fbss')).toBe(
			'FLOWING BLACK SILK SASH',
		);
	});

	it('leaves canonical names unchanged', () => {
		expect(normalizeStoredWatchItemName('FLOWING BLACK SILK SASH')).toBe(
			'FLOWING BLACK SILK SASH',
		);
	});

	it('uppercases unknown custom items', () => {
		expect(normalizeStoredWatchItemName('my custom watch')).toBe(
			'MY CUSTOM WATCH',
		);
	});
});
