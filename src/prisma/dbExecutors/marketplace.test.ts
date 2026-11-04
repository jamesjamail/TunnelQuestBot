import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server, WatchType } from '../client';
import { prisma } from '../../test/mocks/prisma';
import {
	claimMarketplaceMatchNotification,
	filterOutRecentlyNotified,
	getMarketplaceViewForWatch,
	getMarketplaceViewsForUser,
	getWatchIdsWithPendingMarketplaceMatches,
	isPriceCompatible,
	matchNewWatchToMarketplace,
	recordMarketplaceNotifications,
	releaseMarketplaceMatchNotificationClaim,
	sweepMarketplaceMatches,
	type MarketplaceCounterpart,
} from './marketplace';
import {
	makeMarketplaceMatch,
	makeMarketplaceMatchWithWatches,
	makeUser,
	makeWatch,
	makeWatchWithUser,
} from '../../test/factories';

describe('isPriceCompatible', () => {
	it('is compatible when the WTB floor is at or below the WTS ceiling', () => {
		const wtb = makeWatch({
			watchType: WatchType.WTB,
			priceRequirement: 100,
		});
		const wts = makeWatch({
			watchType: WatchType.WTS,
			priceRequirement: 100,
		});
		expect(isPriceCompatible(wtb, wts)).toBe(true);
	});

	it('is incompatible when the WTB floor exceeds the WTS ceiling', () => {
		const wtb = makeWatch({
			watchType: WatchType.WTB,
			priceRequirement: 200,
		});
		const wts = makeWatch({
			watchType: WatchType.WTS,
			priceRequirement: 100,
		});
		expect(isPriceCompatible(wtb, wts)).toBe(false);
	});

	it('treats either side missing a price as negotiable', () => {
		const priced = makeWatch({ priceRequirement: 999999 });
		const unpriced = makeWatch({ priceRequirement: null });
		expect(isPriceCompatible(priced, unpriced)).toBe(true);
		expect(isPriceCompatible(unpriced, priced)).toBe(true);
	});
});

describe('matchNewWatchToMarketplace', () => {
	beforeEach(() => {
		vi.mocked(prisma.user.findUnique).mockReset();
		vi.mocked(prisma.watch.findMany).mockReset();
		vi.mocked(prisma.marketplaceMatch.create).mockReset();
	});

	it('does nothing when the watch is not opted in', async () => {
		const watch = makeWatch({ isPublicallyTradeable: false });

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it('does nothing when the watch is inactive', async () => {
		const watch = makeWatch({
			isPublicallyTradeable: true,
			active: false,
		});

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it('still matches a snoozed watch, since snooze only holds back DMs', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.watch.findMany).mockResolvedValue([]);
		const watch = makeWatch({
			isPublicallyTradeable: true,
			snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
		});

		await matchNewWatchToMarketplace(watch);

		expect(prisma.watch.findMany).toHaveBeenCalled();
	});

	it('does nothing when the owning user no longer exists', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		const watch = makeWatch({ isPublicallyTradeable: true });

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.watch.findMany).not.toHaveBeenCalled();
	});

	it('still matches a globally snoozed user, since snooze only holds back DMs', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(
			makeUser({ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) }),
		);
		vi.mocked(prisma.watch.findMany).mockResolvedValue([]);
		const watch = makeWatch({ isPublicallyTradeable: true });

		await matchNewWatchToMarketplace(watch);

		expect(prisma.watch.findMany).toHaveBeenCalled();
	});

	it('queries the opposite watch type for the same item and server', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.watch.findMany).mockResolvedValue([]);
		const watch = makeWatch({
			watchType: WatchType.WTB,
			server: Server.GREEN,
			itemName: 'SWORD',
			isPublicallyTradeable: true,
		});

		await matchNewWatchToMarketplace(watch);

		expect(prisma.watch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					watchType: WatchType.WTS,
					server: Server.GREEN,
					itemName: 'SWORD',
					active: true,
					isPublicallyTradeable: true,
				}),
			}),
		);
		const where = vi.mocked(prisma.watch.findMany).mock.calls[0][0]?.where;
		expect(where).not.toHaveProperty('snoozedUntil');
		expect(where).not.toHaveProperty('user');
	});

	it('skips a candidate owned by the same discord user', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		const watch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			isPublicallyTradeable: true,
		});
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '100',
					watchType: WatchType.WTS,
				}),
				user: makeUser(),
			},
		]);

		await matchNewWatchToMarketplace(watch);

		expect(prisma.marketplaceMatch.create).not.toHaveBeenCalled();
	});

	describe.each([
		['the new watch owner blocked the counterpart', '100', '200'],
		['the counterpart blocked the new watch owner', '200', '100'],
	])('when %s', (_label, blocker, blocked) => {
		it('does not record the match', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
			vi.mocked(prisma.blockedTrader.findMany).mockResolvedValue([
				{
					id: 1,
					discordUserId: blocker,
					blockedDiscordUserId: blocked,
					createdAt: new Date(),
				},
			]);
			vi.mocked(prisma.watch.findMany).mockResolvedValue([
				{
					...makeWatch({
						id: 2,
						discordUserId: '200',
						watchType: WatchType.WTS,
					}),
					user: makeUser({ discordUserId: '200' }),
				},
			]);
			const watch = makeWatch({
				id: 1,
				discordUserId: '100',
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
			expect(prisma.marketplaceMatch.create).not.toHaveBeenCalled();
		});
	});

	it('still records a match with a third party the owner has not blocked', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.blockedTrader.findMany).mockResolvedValue([
			{
				id: 1,
				discordUserId: '100',
				blockedDiscordUserId: '300',
				createdAt: new Date(),
			},
		]);
		vi.mocked(prisma.marketplaceMatch.create).mockResolvedValue(
			makeMarketplaceMatch() as never,
		);
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '200',
					watchType: WatchType.WTS,
				}),
				user: makeUser({ discordUserId: '200' }),
			},
			{
				...makeWatch({
					id: 3,
					discordUserId: '300',
					watchType: WatchType.WTS,
				}),
				user: makeUser({ discordUserId: '300' }),
			},
		]);
		const watch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			isPublicallyTradeable: true,
		});

		await matchNewWatchToMarketplace(watch);

		expect(prisma.marketplaceMatch.create).toHaveBeenCalledTimes(1);
		expect(prisma.marketplaceMatch.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ wtsWatchId: 2 }),
			}),
		);
	});

	it('skips a price-incompatible candidate', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		const watch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			priceRequirement: 200,
			isPublicallyTradeable: true,
		});
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '200',
					watchType: WatchType.WTS,
					priceRequirement: 100,
				}),
				user: makeUser({ discordUserId: '200' }),
			},
		]);

		await matchNewWatchToMarketplace(watch);

		expect(prisma.marketplaceMatch.create).not.toHaveBeenCalled();
	});

	it('records a match for a compatible, opted-in counterpart with the correct wtb/wts orientation', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.marketplaceMatch.create).mockResolvedValue(
			makeMarketplaceMatch() as never,
		);
		const wtbWatch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			server: Server.BLUE,
			itemName: 'SWORD',
			priceRequirement: 100,
			isPublicallyTradeable: true,
		});
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '200',
					watchType: WatchType.WTS,
					server: Server.BLUE,
					itemName: 'SWORD',
					priceRequirement: 200,
				}),
				user: makeUser({ discordUserId: '200' }),
			},
		]);

		const result = await matchNewWatchToMarketplace(wtbWatch);

		expect(prisma.marketplaceMatch.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					wtbWatchId: 1,
					wtsWatchId: 2,
					server: Server.BLUE,
					itemName: 'SWORD',
				}),
			}),
		);
		expect(result).toHaveLength(1);
	});

	it('returns no match, but does not throw, when the pairing already exists', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '200',
					watchType: WatchType.WTS,
				}),
				user: makeUser({ discordUserId: '200' }),
			},
		]);
		vi.mocked(prisma.marketplaceMatch.create).mockRejectedValue({
			code: 'P2002',
		});
		const watch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			isPublicallyTradeable: true,
		});

		await expect(matchNewWatchToMarketplace(watch)).resolves.toEqual([]);
	});

	it('rethrows an unexpected error from create', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser());
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			{
				...makeWatch({
					id: 2,
					discordUserId: '200',
					watchType: WatchType.WTS,
				}),
				user: makeUser({ discordUserId: '200' }),
			},
		]);
		vi.mocked(prisma.marketplaceMatch.create).mockRejectedValue(
			new Error('db is down'),
		);
		const watch = makeWatch({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			isPublicallyTradeable: true,
		});

		await expect(matchNewWatchToMarketplace(watch)).rejects.toThrow(
			'db is down',
		);
	});
});

describe('sweepMarketplaceMatches', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findMany).mockReset();
		vi.mocked(prisma.marketplaceMatch.create).mockReset();
		vi.mocked(prisma.blockedTrader.findMany).mockReset();
	});

	it('does not pair traders where one has blocked the other', async () => {
		const wtbWatch = {
			...makeWatch({
				id: 1,
				discordUserId: '100',
				watchType: WatchType.WTB,
			}),
			user: makeUser({ discordUserId: '100' }),
		};
		const wtsWatch = {
			...makeWatch({
				id: 2,
				discordUserId: '200',
				watchType: WatchType.WTS,
			}),
			user: makeUser({ discordUserId: '200' }),
		};
		vi.mocked(prisma.watch.findMany)
			.mockResolvedValueOnce([wtbWatch])
			.mockResolvedValueOnce([wtsWatch]);
		vi.mocked(prisma.blockedTrader.findMany).mockResolvedValue([
			{
				id: 1,
				discordUserId: '200',
				blockedDiscordUserId: '100',
				createdAt: new Date(),
			},
		]);

		expect(await sweepMarketplaceMatches()).toEqual([]);
		expect(prisma.marketplaceMatch.create).not.toHaveBeenCalled();
	});

	it('pairs eligible WTB and WTS watches sharing a server and item', async () => {
		const wtbWatch = {
			...makeWatch({
				id: 1,
				discordUserId: '100',
				watchType: WatchType.WTB,
				server: Server.BLUE,
				itemName: 'SWORD',
			}),
			user: makeUser({ discordUserId: '100' }),
		};
		const wtsWatch = {
			...makeWatch({
				id: 2,
				discordUserId: '200',
				watchType: WatchType.WTS,
				server: Server.BLUE,
				itemName: 'SWORD',
			}),
			user: makeUser({ discordUserId: '200' }),
		};
		vi.mocked(prisma.watch.findMany)
			.mockResolvedValueOnce([wtbWatch])
			.mockResolvedValueOnce([wtsWatch]);
		vi.mocked(prisma.marketplaceMatch.create).mockResolvedValue(
			makeMarketplaceMatch() as never,
		);

		const result = await sweepMarketplaceMatches();

		expect(prisma.marketplaceMatch.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ wtbWatchId: 1, wtsWatchId: 2 }),
			}),
		);
		expect(result).toHaveLength(1);
	});

	it('does not pair watches for different items or servers', async () => {
		const wtbWatch = {
			...makeWatch({
				id: 1,
				discordUserId: '100',
				watchType: WatchType.WTB,
				server: Server.BLUE,
				itemName: 'SWORD',
			}),
			user: makeUser({ discordUserId: '100' }),
		};
		const wtsWatch = {
			...makeWatch({
				id: 2,
				discordUserId: '200',
				watchType: WatchType.WTS,
				server: Server.GREEN,
				itemName: 'SWORD',
			}),
			user: makeUser({ discordUserId: '200' }),
		};
		vi.mocked(prisma.watch.findMany)
			.mockResolvedValueOnce([wtbWatch])
			.mockResolvedValueOnce([wtsWatch]);

		const result = await sweepMarketplaceMatches();

		expect(prisma.marketplaceMatch.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});
});

describe('getWatchIdsWithPendingMarketplaceMatches', () => {
	it('queries for matches missing either side notification', async () => {
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([]);

		await getWatchIdsWithPendingMarketplaceMatches();

		expect(prisma.marketplaceMatch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [{ wtbNotifiedAt: null }, { wtsNotifiedAt: null }],
				},
			}),
		);
	});

	it('returns each watch once, and only for the side still pending', async () => {
		const notified = new Date();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			// 	wtb side pending only
			{
				wtbWatchId: 1,
				wtsWatchId: 2,
				wtbNotifiedAt: null,
				wtsNotifiedAt: notified,
			},
			// 	both pending, and watch 1 appears again
			{
				wtbWatchId: 1,
				wtsWatchId: 3,
				wtbNotifiedAt: null,
				wtsNotifiedAt: null,
			},
		] as never);

		expect(
			(await getWatchIdsWithPendingMarketplaceMatches()).sort(),
		).toEqual([1, 3]);
	});
});

describe('claimMarketplaceMatchNotification', () => {
	beforeEach(() => {
		vi.mocked(prisma.marketplaceMatch.updateMany).mockReset();
	});

	it('claims the wtb slot only while it is unset', async () => {
		vi.mocked(prisma.marketplaceMatch.updateMany).mockResolvedValue({
			count: 1,
		});

		expect(await claimMarketplaceMatchNotification(1, 'wtb')).toBe(true);
		expect(prisma.marketplaceMatch.updateMany).toHaveBeenCalledWith({
			where: { id: 1, wtbNotifiedAt: null },
			data: { wtbNotifiedAt: expect.any(Date) },
		});
	});

	it('reports false when another caller already claimed the slot', async () => {
		vi.mocked(prisma.marketplaceMatch.updateMany).mockResolvedValue({
			count: 0,
		});

		expect(await claimMarketplaceMatchNotification(1, 'wts')).toBe(false);
		expect(prisma.marketplaceMatch.updateMany).toHaveBeenCalledWith({
			where: { id: 1, wtsNotifiedAt: null },
			data: { wtsNotifiedAt: expect.any(Date) },
		});
	});
});

describe('releaseMarketplaceMatchNotificationClaim', () => {
	it('clears the wtb notified timestamp', async () => {
		await releaseMarketplaceMatchNotificationClaim(1, 'wtb');

		expect(prisma.marketplaceMatch.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { wtbNotifiedAt: null },
		});
	});

	it('clears the wts notified timestamp', async () => {
		await releaseMarketplaceMatchNotificationClaim(1, 'wts');

		expect(prisma.marketplaceMatch.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { wtsNotifiedAt: null },
		});
	});
});

function makeNotificationCounterpart(
	matchId: number,
	overrides: Parameters<typeof makeWatchWithUser>[0] = {},
): MarketplaceCounterpart {
	return {
		matchId,
		side: 'wtb',
		notified: false,
		watch: makeWatchWithUser({
			discordUserId: '200',
			...overrides,
		}) as never,
	};
}

describe('filterOutRecentlyNotified', () => {
	it('returns everything unfiltered when nothing was recently notified', async () => {
		vi.mocked(
			prisma.marketplaceNotificationHistory.findMany,
		).mockResolvedValue([]);
		const counterparts = [makeNotificationCounterpart(1)];

		expect(
			await filterOutRecentlyNotified(
				'100',
				'SASH',
				Server.GREEN,
				counterparts,
			),
		).toEqual(counterparts);
	});

	it('drops a counterpart with a recent history row on the matching side', async () => {
		vi.mocked(
			prisma.marketplaceNotificationHistory.findMany,
		).mockResolvedValue([
			{ counterpartDiscordUserId: '200', side: 'wtb' },
		] as never);

		expect(
			await filterOutRecentlyNotified('100', 'SASH', Server.GREEN, [
				makeNotificationCounterpart(1, { discordUserId: '200' }),
			]),
		).toEqual([]);
	});

	it('keeps a counterpart whose recent history is on the other side', async () => {
		vi.mocked(
			prisma.marketplaceNotificationHistory.findMany,
		).mockResolvedValue([
			{ counterpartDiscordUserId: '200', side: 'wts' },
		] as never);
		const counterparts = [
			makeNotificationCounterpart(1, { discordUserId: '200' }),
		];

		expect(
			await filterOutRecentlyNotified(
				'100',
				'SASH',
				Server.GREEN,
				counterparts,
			),
		).toEqual(counterparts);
	});

	it('only queries within the throttle window', async () => {
		vi.mocked(
			prisma.marketplaceNotificationHistory.findMany,
		).mockResolvedValue([]);

		await filterOutRecentlyNotified('100', 'SASH', Server.GREEN, [
			makeNotificationCounterpart(1),
		]);

		const call = vi.mocked(prisma.marketplaceNotificationHistory.findMany)
			.mock.calls[0][0] as {
			where: { notifiedAt: { gt: Date } };
		};
		expect(call.where.notifiedAt.gt.getTime()).toBeLessThan(Date.now());
	});

	it('does not query at all for an empty list', async () => {
		expect(
			await filterOutRecentlyNotified('100', 'SASH', Server.GREEN, []),
		).toEqual([]);
		expect(
			prisma.marketplaceNotificationHistory.findMany,
		).not.toHaveBeenCalled();
	});
});

describe('recordMarketplaceNotifications', () => {
	it('upserts one row per counterpart, keyed on recipient/counterpart/item/server/side', async () => {
		await recordMarketplaceNotifications('100', 'SASH', Server.GREEN, [
			makeNotificationCounterpart(1, { discordUserId: '200' }),
			makeNotificationCounterpart(2, {
				discordUserId: '300',
				watchType: WatchType.WTS,
			}),
		]);

		expect(
			prisma.marketplaceNotificationHistory.upsert,
		).toHaveBeenCalledTimes(2);
		expect(
			prisma.marketplaceNotificationHistory.upsert,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					recipientDiscordUserId_counterpartDiscordUserId_itemName_server_side:
						{
							recipientDiscordUserId: '100',
							counterpartDiscordUserId: '200',
							itemName: 'SASH',
							server: Server.GREEN,
							side: 'wtb',
						},
				},
			}),
		);
	});

	it('does nothing for an empty list', async () => {
		await recordMarketplaceNotifications('100', 'SASH', Server.GREEN, []);

		expect(
			prisma.marketplaceNotificationHistory.upsert,
		).not.toHaveBeenCalled();
	});
});

// 	viewer is watch 1 (user 100, WTB); the counterpart is watch 2 (user 200, WTS)
function matchWith(
	overrides: {
		wtb?: Parameters<typeof makeWatchWithUser>[0];
		wts?: Parameters<typeof makeWatchWithUser>[0];
		match?: Parameters<typeof makeMarketplaceMatchWithWatches>[0];
	} = {},
) {
	const base = makeMarketplaceMatchWithWatches(overrides.match);
	return {
		...base,
		wtbWatch: { ...base.wtbWatch, ...overrides.wtb },
		wtsWatch: { ...base.wtsWatch, ...overrides.wts },
	};
}

function mockViewerWatch(
	overrides: Parameters<typeof makeWatchWithUser>[0] = {},
) {
	vi.mocked(prisma.watch.findUnique).mockResolvedValue(
		makeWatchWithUser({
			id: 1,
			discordUserId: '100',
			watchType: WatchType.WTB,
			...overrides,
		}) as never,
	);
}

describe('getMarketplaceViewForWatch', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findUnique).mockReset();
		vi.mocked(prisma.marketplaceMatch.findMany)
			.mockReset()
			.mockResolvedValue([]);
		vi.mocked(prisma.blockedTrader.findMany)
			.mockReset()
			.mockResolvedValue([]);
		vi.mocked(prisma.hiddenTrader.findMany)
			.mockReset()
			.mockResolvedValue([]);
	});

	it('is null when the watch no longer exists', async () => {
		vi.mocked(prisma.watch.findUnique).mockResolvedValue(null);

		expect(await getMarketplaceViewForWatch(1)).toBeNull();
	});

	it('lists the counterpart on the other side of each match, newest match first', async () => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({ match: { id: 7 } }),
		] as never);

		const view = await getMarketplaceViewForWatch(1);

		expect(prisma.marketplaceMatch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ orderBy: { id: 'desc' } }),
		);
		expect(view?.counterparts).toEqual([
			expect.objectContaining({
				matchId: 7,
				side: 'wtb',
				watch: expect.objectContaining({ id: 2, discordUserId: '200' }),
			}),
		]);
	});

	it('reports whether this side has already been told', async () => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({
				match: {
					id: 1,
					wtbNotifiedAt: new Date(),
					wtsNotifiedAt: null,
				},
			}),
			matchWith({ match: { id: 2, wtbNotifiedAt: null } }),
		] as never);

		const view = await getMarketplaceViewForWatch(1);

		expect(view?.counterparts.map((c) => c.notified)).toEqual([
			true,
			false,
		]);
	});

	it('reads the wts side when the viewer is the seller', async () => {
		mockViewerWatch({
			id: 2,
			discordUserId: '200',
			watchType: WatchType.WTS,
		});
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({ match: { id: 3, wtsNotifiedAt: new Date() } }),
		] as never);

		const view = await getMarketplaceViewForWatch(2);

		expect(view?.counterparts).toEqual([
			expect.objectContaining({
				matchId: 3,
				side: 'wts',
				notified: true,
				watch: expect.objectContaining({ id: 1, discordUserId: '100' }),
			}),
		]);
	});

	it.each([
		['unlisted', { isPublicallyTradeable: false }],
		['ended', { active: false }],
	])(
		'shows no counterparts, and reads no matches, for a watch that is %s',
		async (_name, overrides) => {
			mockViewerWatch(overrides);

			const view = await getMarketplaceViewForWatch(1);

			expect(view?.counterparts).toEqual([]);
			expect(view?.watch.id).toBe(1);
			expect(prisma.marketplaceMatch.findMany).not.toHaveBeenCalled();
		},
	);

	it.each([
		['unlisted', { isPublicallyTradeable: false }],
		['ended', { active: false }],
	])(
		'drops a counterpart whose watch has become %s since the match',
		async (_name, overrides) => {
			mockViewerWatch();
			vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
				matchWith({ wts: overrides }),
			] as never);

			expect((await getMarketplaceViewForWatch(1))?.counterparts).toEqual(
				[],
			);
		},
	);

	it('keeps a snoozed counterpart and a snoozed viewer: snooze never hides anyone', async () => {
		const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000);
		mockViewerWatch({ snoozedUntil });
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({
				wts: {
					snoozedUntil,
					user: makeUser({ discordUserId: '200', snoozedUntil }),
				},
			}),
		] as never);

		expect(
			(await getMarketplaceViewForWatch(1))?.counterparts,
		).toHaveLength(1);
	});

	it.each([
		[
			'the viewer blocked the counterpart',
			{ discordUserId: '100', blockedDiscordUserId: '200' },
		],
		[
			'the counterpart blocked the viewer',
			{ discordUserId: '200', blockedDiscordUserId: '100' },
		],
	])('drops the counterpart when %s', async (_name, block) => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith(),
		] as never);
		vi.mocked(prisma.blockedTrader.findMany).mockResolvedValue([
			block,
		] as never);

		expect((await getMarketplaceViewForWatch(1))?.counterparts).toEqual([]);
	});

	it('drops a counterpart whose price became incompatible after the match was recorded', async () => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({
				wtb: { priceRequirement: 2000 },
				wts: { priceRequirement: 1000 },
			}),
		] as never);

		expect((await getMarketplaceViewForWatch(1))?.counterparts).toEqual([]);
	});

	it('shows a counterpart again once its price becomes compatible', async () => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith({
				wtb: { priceRequirement: 500 },
				wts: { priceRequirement: 1000 },
			}),
		] as never);

		expect(
			(await getMarketplaceViewForWatch(1))?.counterparts,
		).toHaveLength(1);
	});

	it('drops a trader the viewer hid, but not one who merely hid the viewer', async () => {
		mockViewerWatch();
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith(),
		] as never);

		vi.mocked(prisma.hiddenTrader.findMany).mockResolvedValue([
			{ discordUserId: '100', hiddenDiscordUserId: '200' },
		] as never);
		expect((await getMarketplaceViewForWatch(1))?.counterparts).toEqual([]);

		// 	a hide is one-way: the query only asks for the viewer's own hides, so
		// 	a row the other way round is never returned - and were it, it must
		// 	not apply to the viewer
		vi.mocked(prisma.hiddenTrader.findMany).mockResolvedValue([
			{ discordUserId: '200', hiddenDiscordUserId: '100' },
		] as never);
		expect(
			(await getMarketplaceViewForWatch(1))?.counterparts,
		).toHaveLength(1);
		expect(prisma.hiddenTrader.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					discordUserId: { in: ['100'] },
					hiddenDiscordUserId: { in: ['200'] },
				},
			}),
		);
	});
});

describe('getMarketplaceViewsForUser', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findMany).mockReset();
		vi.mocked(prisma.marketplaceMatch.findMany)
			.mockReset()
			.mockResolvedValue([]);
		vi.mocked(prisma.blockedTrader.findMany)
			.mockReset()
			.mockResolvedValue([]);
		vi.mocked(prisma.hiddenTrader.findMany)
			.mockReset()
			.mockResolvedValue([]);
	});

	it('returns a view per active watch, including unlisted ones without counterparts', async () => {
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			makeWatchWithUser({ id: 1, watchType: WatchType.WTB }),
			makeWatchWithUser({ id: 5, isPublicallyTradeable: false }),
		] as never);
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([
			matchWith(),
		] as never);

		const views = await getMarketplaceViewsForUser('100');

		expect(prisma.watch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { discordUserId: '100', active: true },
			}),
		);
		expect(views.map((v) => [v.watch.id, v.counterparts.length])).toEqual([
			[1, 1],
			[5, 0],
		]);
		// 	the unlisted watch is never even looked up in the ledger
		expect(prisma.marketplaceMatch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [
						{ wtbWatchId: { in: [1] } },
						{ wtsWatchId: { in: [1] } },
					],
				},
			}),
		);
	});

	it('makes no ledger query when the user has nothing listed', async () => {
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			makeWatchWithUser({ isPublicallyTradeable: false }),
		] as never);

		await getMarketplaceViewsForUser('100');

		expect(prisma.marketplaceMatch.findMany).not.toHaveBeenCalled();
	});
});
