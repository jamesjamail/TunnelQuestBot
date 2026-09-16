import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server, WatchType } from '../client';
import { prisma } from '../../test/mocks/prisma';
import {
	claimMarketplaceMatchNotification,
	getUnnotifiedMarketplaceMatches,
	isPriceCompatible,
	matchNewWatchToMarketplace,
	releaseMarketplaceMatchNotificationClaim,
	sweepMarketplaceMatches,
} from './marketplace';
import {
	makeMarketplaceMatch,
	makeUser,
	makeWatch,
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

	it('does nothing when the watch is snoozed', async () => {
		const watch = makeWatch({
			isPublicallyTradeable: true,
			snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
		});

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it('does nothing when the owning user no longer exists', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		const watch = makeWatch({ isPublicallyTradeable: true });

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.watch.findMany).not.toHaveBeenCalled();
	});

	it('does nothing when the owning user is globally snoozed', async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(
			makeUser({ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) }),
		);
		const watch = makeWatch({ isPublicallyTradeable: true });

		expect(await matchNewWatchToMarketplace(watch)).toEqual([]);
		expect(prisma.watch.findMany).not.toHaveBeenCalled();
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

describe('getUnnotifiedMarketplaceMatches', () => {
	it('queries for matches missing either side notification', async () => {
		vi.mocked(prisma.marketplaceMatch.findMany).mockResolvedValue([]);

		await getUnnotifiedMarketplaceMatches();

		expect(prisma.marketplaceMatch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [{ wtbNotifiedAt: null }, { wtsNotifiedAt: null }],
				},
			}),
		);
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
