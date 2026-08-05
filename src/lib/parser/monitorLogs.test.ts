import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../streams/streamAuction', () => ({
	streamAuctionToAllStreamChannels: vi.fn(async () => undefined),
	getEnvironmentVariable: (n: string) => process.env[n] ?? '',
}));
vi.mock('../watchNotification/watchNotification', () => ({
	triggerFoundWatchedItems: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { Server } from '@prisma/client';
import { handleLogLine } from './monitorLogs';
import { redis } from '../../test/mocks/redis';

describe('handleLogLine auction cache', () => {
	it('stores parsed auction data with a TTL', async () => {
		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 100pp'");

		const cacheSetCall = vi
			.mocked(redis.set)
			.mock.calls.find(([key]) => String(key).startsWith('auctionLog:'));

		expect(cacheSetCall).toBeDefined();
		expect(cacheSetCall?.slice(2)).toEqual(
			expect.arrayContaining(['EX', expect.any(Number)]),
		);
	});
});
