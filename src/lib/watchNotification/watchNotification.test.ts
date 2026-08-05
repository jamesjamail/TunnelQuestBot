import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../helpers/fetchHistoricalPricing', () => ({
	fetchHistoricalPricingForItem: vi.fn(async () => null),
	fetchHistoricalPricingForItems: vi.fn(async () => ({})),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server, WatchType } from '@prisma/client';
import {
	shouldUserBeNotified,
	triggerFoundWatchedItem,
} from './watchNotification';
import { client } from '../../test/mocks/discordClient';
import { prisma } from '../../test/mocks/prisma';
import { makeBlockedPlayer, makeWatchWithUser } from '../../test/factories';

describe('shouldUserBeNotified', () => {
	it('notifies WTS watch when auction price is at or under budget', async () => {
		const watch = makeWatchWithUser({
			watchType: WatchType.WTS,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 500)).toBe(
			true,
		);
		expect(await shouldUserBeNotified(watch, [], 'Soandso', 1000)).toBe(
			true,
		);
	});

	it('does not notify WTS watch when auction price exceeds budget', async () => {
		const watch = makeWatchWithUser({
			watchType: WatchType.WTS,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 5000)).toBe(
			false,
		);
	});

	it('notifies WTB watch when auction price meets minimum (regression guard)', async () => {
		const watch = makeWatchWithUser({
			watchType: WatchType.WTB,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 1500)).toBe(
			true,
		);
		expect(await shouldUserBeNotified(watch, [], 'Soandso', 500)).toBe(
			false,
		);
	});

	it('does not suppress notification when block is on a different server', async () => {
		const watch = makeWatchWithUser({ server: Server.BLUE });
		const blockedPlayers = [
			makeBlockedPlayer({ server: Server.GREEN, player: 'SOANDSO' }),
		];

		expect(
			await shouldUserBeNotified(
				watch,
				blockedPlayers,
				'Soandso',
				undefined,
			),
		).toBe(true);
	});

	it('suppresses notification when block is on the same server (regression guard)', async () => {
		const watch = makeWatchWithUser({ server: Server.BLUE });
		const blockedPlayers = [
			makeBlockedPlayer({ server: Server.BLUE, player: 'SOANDSO' }),
		];

		expect(
			await shouldUserBeNotified(
				watch,
				blockedPlayers,
				'Soandso',
				undefined,
			),
		).toBe(false);
	});
});

describe('triggerFoundWatchedItem debounce', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findUnique).mockResolvedValue(
			makeWatchWithUser({ priceRequirement: null }),
		);
		vi.mocked(prisma.blockedPlayer.findMany).mockResolvedValue([]);
		vi.mocked(client.users.send).mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({}), 20)),
		);
	});

	it('sends only one notification for concurrent triggers with the same debounce key', async () => {
		await Promise.all([
			triggerFoundWatchedItem(
				1,
				'Soandso',
				100,
				'WTS FLOWING BLACK SILK SASH 100pp',
			),
			triggerFoundWatchedItem(
				1,
				'Soandso',
				100,
				'WTS FLOWING BLACK SILK SASH 100pp',
			),
		]);

		expect(client.users.send).toHaveBeenCalledTimes(1);
	});
});
