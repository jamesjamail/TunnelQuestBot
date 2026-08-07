import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../helpers/fetchHistoricalPricing', () => ({
	fetchHistoricalPricingForItem: vi.fn(async () => null),
	fetchHistoricalPricingForItems: vi.fn(async () => ({})),
}));
vi.mock('../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));
vi.mock('../content/messages/messageBuilder', () => ({
	watchNotificationBuilder: vi.fn(async () => ({ data: { title: 'watch' } })),
}));
vi.mock('../content/buttons/buttonRowBuilder', () => ({
	buttonRowBuilder: vi.fn(() => []),
	MessageTypes: { watchNotification: 'watchNotification' },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server, WatchType } from '../../prisma/client';
import {
	generateDebounceKey,
	shouldUserBeNotified,
	triggerFoundWatchedItem,
} from './watchNotification';
import { gracefullyHandleError } from '../helpers/errors';
import { client } from '../../test/mocks/discordClient';
import { prisma } from '../../test/mocks/prisma';
import { redis } from '../../test/mocks/redis';
import { watchNotificationBuilder } from '../content/messages/messageBuilder';
import {
	makeBlockedPlayer,
	makeBlockedPlayerByWatch,
	makeWatchWithUser,
} from '../../test/factories';

function permissiveWatch(
	overrides: Parameters<typeof makeWatchWithUser>[0] = {},
	userOverrides: Parameters<typeof makeWatchWithUser>[1] = {},
) {
	return makeWatchWithUser(
		{
			active: true,
			snoozedUntil: null,
			priceRequirement: null,
			...overrides,
		},
		userOverrides,
	);
}

describe('shouldUserBeNotified gate isolation', () => {
	it('blocks when the watch is inactive', async () => {
		const watch = permissiveWatch({ active: false });

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 100)).toBe(
			false,
		);
	});

	it('blocks when the watch is snoozed in the future', async () => {
		const watch = permissiveWatch({
			snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 100)).toBe(
			false,
		);
	});

	it('allows when watch snooze is in the past', async () => {
		const watch = permissiveWatch({
			snoozedUntil: new Date(Date.now() - 60 * 1000),
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 100)).toBe(
			true,
		);
	});

	it('blocks when the user is globally snoozed', async () => {
		const watch = permissiveWatch(
			{},
			{ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) },
		);

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 100)).toBe(
			false,
		);
	});

	it('blocks when the auctioning player is globally blocked on the watch server', async () => {
		const watch = permissiveWatch({ server: Server.BLUE });
		const blockedPlayers = [
			makeBlockedPlayer({ server: Server.BLUE, player: 'SOANDSO' }),
		];

		expect(
			await shouldUserBeNotified(watch, blockedPlayers, 'Soandso', 100),
		).toBe(false);
	});

	it('blocks when the player is blocked for this specific watch', async () => {
		const watch = {
			...permissiveWatch(),
			blockedWatches: [
				makeBlockedPlayerByWatch({ watchId: 1, player: 'SOANDSO' }),
			],
		};

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 100)).toBe(
			false,
		);
	});

	it('blocks WTS watch when auction price exceeds budget and allows at equal', async () => {
		const watch = permissiveWatch({
			watchType: WatchType.WTS,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 1001)).toBe(
			false,
		);
		expect(await shouldUserBeNotified(watch, [], 'Soandso', 1000)).toBe(
			true,
		);
	});

	it('blocks WTB watch below minimum and allows at equal', async () => {
		const watch = permissiveWatch({
			watchType: WatchType.WTB,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 999)).toBe(
			false,
		);
		expect(await shouldUserBeNotified(watch, [], 'Soandso', 1000)).toBe(
			true,
		);
	});

	it('blocks when price is missing but watch has a price requirement (documented choice)', async () => {
		// Unknown-item auctions pass undefined price; this gate blocks them even
		// though /watch copy says price criteria are not considered for custom items.
		const watch = permissiveWatch({ priceRequirement: 500 });

		expect(
			await shouldUserBeNotified(watch, [], 'Soandso', undefined),
		).toBe(false);
	});

	it('allows unknown-item style watches with price requirement when price is undefined only if no requirement is enforced elsewhere', async () => {
		// shouldUserBeNotified has no unknown-item branch; priceRequirement with
		// undefined price always blocks. messageBuilder disclaimer describes intent.
		const watch = permissiveWatch({
			itemName: 'SOME MADE UP THING',
			priceRequirement: 500,
		});

		expect(
			await shouldUserBeNotified(watch, [], 'Soandso', undefined),
		).toBe(false);
	});

	it('allows notification when all gates are permissive', async () => {
		const watch = permissiveWatch({
			watchType: WatchType.WTS,
			priceRequirement: 1000,
		});

		expect(await shouldUserBeNotified(watch, [], 'Soandso', 500)).toBe(
			true,
		);
	});

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

describe('generateDebounceKey scoping', () => {
	it('changes when the watch id changes', () => {
		expect(generateDebounceKey(1, 'Soandso', 100)).not.toBe(
			generateDebounceKey(2, 'Soandso', 100),
		);
	});

	it('changes when the player changes', () => {
		expect(generateDebounceKey(1, 'Soandso', 100)).not.toBe(
			generateDebounceKey(1, 'Otherguy', 100),
		);
	});

	it('changes when the price changes', () => {
		expect(generateDebounceKey(1, 'Soandso', 100)).not.toBe(
			generateDebounceKey(1, 'Soandso', 200),
		);
	});
});

describe('triggerFoundWatchedItem debounce', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findUnique).mockResolvedValue(
			makeWatchWithUser({ priceRequirement: null }),
		);
		vi.mocked(prisma.blockedPlayer.findMany).mockResolvedValue([]);
		vi.mocked(client.users.send).mockResolvedValue({} as never);
		vi.mocked(watchNotificationBuilder).mockResolvedValue({
			data: { title: 'watch' },
		} as never);
	});

	it('claims the debounce key before attempting the DM send', async () => {
		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);

		const setOrder = vi.mocked(redis.set).mock.invocationCallOrder[0];
		const sendOrder = vi.mocked(client.users.send).mock
			.invocationCallOrder[0];
		expect(setOrder).toBeLessThan(sendOrder);
	});

	it('sends only one notification for concurrent triggers with the same debounce key', async () => {
		vi.mocked(client.users.send).mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve({}), 20)),
		);

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

	it('releases the debounce key after a transient send failure', async () => {
		vi.mocked(client.users.send).mockRejectedValueOnce(
			new Error('cannot DM'),
		);

		await expect(
			triggerFoundWatchedItem(
				1,
				'Soandso',
				100,
				'WTS FLOWING BLACK SILK SASH 100pp',
			),
		).resolves.toBeUndefined();

		expect(gracefullyHandleError).toHaveBeenCalledWith(
			expect.any(Error),
			undefined,
			undefined,
			expect.objectContaining({ id: 1 }),
		);

		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);
		expect(redis.del).toHaveBeenCalled();
		expect(client.users.send).toHaveBeenCalledTimes(2);
	});

	it('keeps the debounce key after Discord reports closed DMs', async () => {
		vi.mocked(client.users.send).mockRejectedValueOnce({ code: 50007 });

		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);
		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);

		expect(redis.del).not.toHaveBeenCalled();
		expect(client.users.send).toHaveBeenCalledTimes(1);
	});

	it('releases the debounce key after embed construction fails', async () => {
		vi.mocked(watchNotificationBuilder).mockRejectedValueOnce(
			new Error('pricing unavailable'),
		);

		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);
		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);

		expect(redis.del).toHaveBeenCalled();
		expect(client.users.send).toHaveBeenCalledTimes(1);
	});

	it('suppresses a second identical notification within the debounce window', async () => {
		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);
		await triggerFoundWatchedItem(
			1,
			'Soandso',
			100,
			'WTS FLOWING BLACK SILK SASH 100pp',
		);

		expect(client.users.send).toHaveBeenCalledTimes(1);
	});

	it('handles users.send rejection gracefully without throwing', async () => {
		vi.mocked(client.users.send).mockRejectedValue(
			new Error('blocked DMs'),
		);

		await expect(
			triggerFoundWatchedItem(
				1,
				'Soandso',
				100,
				'WTS FLOWING BLACK SILK SASH 100pp',
			),
		).resolves.toBeUndefined();

		expect(gracefullyHandleError).toHaveBeenCalled();
	});
});
