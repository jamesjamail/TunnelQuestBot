import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../prisma/init', () => import('../test/mocks/prisma'));
vi.mock('../redis/init', () => import('../test/mocks/redis'));
vi.mock('../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { generateLogLine } from './logFaker';

const AUCTION_REGEX = /(\w+) auctions?, '(.+)'/;

describe('logFaker', () => {
	it('generates lines that match the auction regex used by monitorLogs', () => {
		const line = generateLogLine();
		expect(line).toMatch(AUCTION_REGEX);
	});

	it('produces varied output across calls', () => {
		const lines = new Set(
			Array.from({ length: 20 }, () => generateLogLine()),
		);
		expect(lines.size).toBeGreaterThan(1);
	});
});
