import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect } from 'vitest';
import { Server, WatchType } from '../client';

async function getPrisma() {
	const { prisma } = await import('../init');
	return prisma;
}

async function seedUser(discordUserId = '100') {
	const prisma = await getPrisma();
	return prisma.user.create({
		data: { discordUserId, discordUsername: 'tester' },
	});
}

describe('marketplace dbExecutor (integration)', () => {
	describe('matchNewWatchToMarketplace', () => {
		it('matches a fresh WTB watch against an existing opted-in WTS watch', async () => {
			const { upsertWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			const prisma = await getPrisma();
			await seedUser('100');
			await seedUser('200');

			const wtsWatch = await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			const matches = await matchNewWatchToMarketplace(wtbWatch);

			expect(matches).toHaveLength(1);
			expect(matches[0].wtbWatchId).toBe(wtbWatch.id);
			expect(matches[0].wtsWatchId).toBe(wtsWatch.id);
			expect(await prisma.marketplaceMatch.count()).toBe(1);
		});

		it('does not match when the candidate has not opted in', async () => {
			const { upsertWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: false,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			expect(await matchNewWatchToMarketplace(wtbWatch)).toEqual([]);
		});

		it('does not match a user against their own opposite-type watch', async () => {
			const { upsertWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			await seedUser('100');

			await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			expect(await matchNewWatchToMarketplace(wtbWatch)).toEqual([]);
		});

		it('does not match when the WTB floor exceeds the WTS ceiling', async () => {
			const { upsertWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
				priceRequirement: 100,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
				priceRequirement: 200,
			});

			expect(await matchNewWatchToMarketplace(wtbWatch)).toEqual([]);
		});

		it('is idempotent: re-checking an already-matched watch does not duplicate the pairing', async () => {
			const { upsertWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			const prisma = await getPrisma();
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			await matchNewWatchToMarketplace(wtbWatch);
			const second = await matchNewWatchToMarketplace(wtbWatch);

			expect(second).toEqual([]);
			expect(await prisma.marketplaceMatch.count()).toBe(1);
		});

		it('does not match a snoozed candidate watch', async () => {
			const { upsertWatch, snoozeWatch } = await import('./watch');
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			await seedUser('100');
			await seedUser('200');

			const wtsWatch = await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			await snoozeWatch(wtsWatch, 6);
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			expect(await matchNewWatchToMarketplace(wtbWatch)).toEqual([]);
		});
	});

	describe('sweepMarketplaceMatches', () => {
		it('finds a pairing formed after both watches already existed', async () => {
			const { upsertWatch } = await import('./watch');
			const { sweepMarketplaceMatches } = await import('./marketplace');
			await seedUser('100');
			await seedUser('200');

			// 	neither opted in yet - matchNewWatchToMarketplace would not have
			// 	found this pairing at either watch's creation time
			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: false,
			});
			await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: false,
			});

			// 	now both opt in, well after creation
			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});

			const matches = await sweepMarketplaceMatches();

			expect(matches).toHaveLength(1);
		});
	});

	describe('notification claim lifecycle', () => {
		it('claims once, then reports the slot as already taken', async () => {
			const { upsertWatch } = await import('./watch');
			const {
				matchNewWatchToMarketplace,
				claimMarketplaceMatchNotification,
				releaseMarketplaceMatchNotificationClaim,
			} = await import('./marketplace');
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('200', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
			const wtbWatch = await upsertWatch('100', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: true,
			});
			const [match] = await matchNewWatchToMarketplace(wtbWatch);

			expect(
				await claimMarketplaceMatchNotification(match.id, 'wtb'),
			).toBe(true);
			expect(
				await claimMarketplaceMatchNotification(match.id, 'wtb'),
			).toBe(false);

			await releaseMarketplaceMatchNotificationClaim(match.id, 'wtb');
			expect(
				await claimMarketplaceMatchNotification(match.id, 'wtb'),
			).toBe(true);
		});
	});
});
