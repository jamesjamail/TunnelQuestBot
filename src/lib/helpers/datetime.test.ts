import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	formatWatchExpirationTimestamp,
	formatSnoozeExpirationTimestamp,
	getExpirationTimestampForSnooze,
} from './datetime';

const FROZEN_NOW = new Date('2026-01-01T00:00:00.000Z');
const ORIGINAL_WATCH_DURATION = process.env.WATCH_DURATION_IN_DAYS;

describe('datetime helpers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FROZEN_NOW);
		process.env.WATCH_DURATION_IN_DAYS = '7';
	});

	afterEach(() => {
		vi.useRealTimers();
		if (ORIGINAL_WATCH_DURATION === undefined) {
			delete process.env.WATCH_DURATION_IN_DAYS;
		} else {
			process.env.WATCH_DURATION_IN_DAYS = ORIGINAL_WATCH_DURATION;
		}
	});

	describe('formatWatchExpirationTimestamp', () => {
		it('formats expiration from created timestamp using default watch duration', () => {
			expect(formatWatchExpirationTimestamp(new Date())).toBe(
				'Expires in 7 days, 0 hours, and 0 minutes',
			);
		});

		it('respects WATCH_DURATION_IN_DAYS env override', () => {
			process.env.WATCH_DURATION_IN_DAYS = '3';
			expect(formatWatchExpirationTimestamp(new Date())).toBe(
				'Expires in 3 days, 0 hours, and 0 minutes',
			);
		});

		it('falls back to 7 days when WATCH_DURATION_IN_DAYS is unset', () => {
			delete process.env.WATCH_DURATION_IN_DAYS;
			expect(formatWatchExpirationTimestamp(new Date())).toBe(
				'Expires in 7 days, 0 hours, and 0 minutes',
			);
		});
	});

	describe('formatSnoozeExpirationTimestamp', () => {
		it('formats remaining snooze time', () => {
			const endTimestamp = new Date(
				FROZEN_NOW.getTime() + 2.5 * 60 * 60 * 1000,
			);
			expect(formatSnoozeExpirationTimestamp(endTimestamp)).toBe(
				'Snoozed for another 2 hours and 30 minutes',
			);
		});
	});

	describe('getExpirationTimestampForSnooze', () => {
		it('returns a timestamp the requested hours after now', () => {
			const result = getExpirationTimestampForSnooze(12);
			expect(result.getTime()).toBe(
				FROZEN_NOW.getTime() + 12 * 60 * 60 * 1000,
			);
		});

		it('defaults to 6 hours when no argument is passed', () => {
			const result = getExpirationTimestampForSnooze();
			expect(result.getTime()).toBe(
				FROZEN_NOW.getTime() + 6 * 60 * 60 * 1000,
			);
		});

		it('treats 0 hours as the 6-hour default', () => {
			const result = getExpirationTimestampForSnooze(0);
			expect(result.getTime()).toBe(
				FROZEN_NOW.getTime() + 6 * 60 * 60 * 1000,
			);
		});
	});
});
