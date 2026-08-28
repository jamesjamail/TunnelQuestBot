import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../streams/streamAuction', () => ({
	streamAuctionToAllStreamChannels: vi.fn(async () => undefined),
}));
vi.mock('../helpers/env', () => ({
	getEnvironmentVariable: (n: string) => process.env[n] ?? '',
}));
vi.mock('../watchNotification/watchNotification', () => ({
	triggerFoundWatchedItems: vi.fn(async () => undefined),
}));

import { describe, it, expect, afterEach } from 'vitest';
import { Server } from '../../prisma/client';
import { resolveCanonicalItemName } from '../gameData/consolidatedItems';
import { handleLogLine } from './monitorLogs';
import { state } from './state';
import { triggerFoundWatchedItems } from '../watchNotification/watchNotification';
import { getWatchesGroupedByServer } from '../../prisma/dbExecutors/watch';
import { initializeGroupedWatches } from '../../prisma/dbExecutors/watch';
import { prisma } from '../../test/mocks/prisma';
import { makeWatch } from '../../test/factories';

describe('resolveCanonicalItemName', () => {
	it('resolves aliases to canonical item names', () => {
		expect(resolveCanonicalItemName('FBSS')).toBe(
			'FLOWING BLACK SILK SASH',
		);
	});

	it('returns canonical names unchanged', () => {
		expect(resolveCanonicalItemName('FLOWING BLACK SILK SASH')).toBe(
			'FLOWING BLACK SILK SASH',
		);
	});

	it('returns unknown strings unchanged', () => {
		expect(resolveCanonicalItemName('SOME MADE UP THING')).toBe(
			'SOME MADE UP THING',
		);
	});
});

describe('handleLogLine alias matching', () => {
	afterEach(() => {
		state.watchedItems = initializeGroupedWatches();
		vi.mocked(triggerFoundWatchedItems).mockClear();
	});

	it('matches alias auction text against a canonical watch key', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [42],
		};

		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 500pp'");

		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[42],
			'Soandso',
			500,
			expect.any(String),
		);
	});

	it('matches canonical auction text against an alias-named watch key', async () => {
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			makeWatch({ id: 43, itemName: 'FBSS' }),
		]);
		state.watchedItems = await getWatchesGroupedByServer();

		await handleLogLine(
			Server.BLUE,
			"Soandso auctions, 'WTS Flowing Black Silk Sash 500pp'",
		);

		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[43],
			'Soandso',
			500,
			expect.any(String),
		);
	});
});
