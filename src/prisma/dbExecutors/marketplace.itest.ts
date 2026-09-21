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

async function seedOpposingWatches() {
	const { upsertWatch } = await import('./watch');
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
	return { wtbWatch, wtsWatch };
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

		it('still matches a snoozed candidate watch: snooze only holds back its DMs', async () => {
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

			expect(await matchNewWatchToMarketplace(wtbWatch)).toHaveLength(1);
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
	describe('trader blocks', () => {
		it.each([
			['the buyer blocked the seller', '100', '200'],
			['the seller blocked the buyer', '200', '100'],
		])(
			'does not pair traders when %s',
			async (_label, blocker, blocked) => {
				const { addTraderBlock } = await import('./block');
				const { matchNewWatchToMarketplace, sweepMarketplaceMatches } =
					await import('./marketplace');
				const prisma = await getPrisma();
				const { wtbWatch } = await seedOpposingWatches();
				await addTraderBlock(blocker, blocked);

				expect(await matchNewWatchToMarketplace(wtbWatch)).toEqual([]);
				expect(await sweepMarketplaceMatches()).toEqual([]);
				expect(await prisma.marketplaceMatch.count()).toBe(0);
			},
		);

		it('pairs them again once the block is removed', async () => {
			const { addTraderBlock, removeTraderBlock } = await import(
				'./block'
			);
			const { sweepMarketplaceMatches } = await import('./marketplace');
			await seedOpposingWatches();
			await addTraderBlock('100', '200');
			expect(await sweepMarketplaceMatches()).toEqual([]);

			expect(await removeTraderBlock('100', '200')).toBe(1);

			expect(await sweepMarketplaceMatches()).toHaveLength(1);
		});

		it('hides a match recorded before the block was added from both sides', async () => {
			const { addTraderBlock } = await import('./block');
			const { matchNewWatchToMarketplace, getMarketplaceViewForWatch } =
				await import('./marketplace');
			const { wtbWatch, wtsWatch } = await seedOpposingWatches();
			await matchNewWatchToMarketplace(wtbWatch);
			expect(
				(await getMarketplaceViewForWatch(wtbWatch.id))?.counterparts,
			).toHaveLength(1);

			await addTraderBlock('200', '100');

			expect(
				(await getMarketplaceViewForWatch(wtbWatch.id))?.counterparts,
			).toEqual([]);
			expect(
				(await getMarketplaceViewForWatch(wtsWatch.id))?.counterparts,
			).toEqual([]);
		});

		it('blocks a user who has no User row of their own', async () => {
			const { addTraderBlock } = await import('./block');
			const prisma = await getPrisma();
			await seedUser('100');

			await addTraderBlock('100', 'never-seen');

			expect(await prisma.blockedTrader.count()).toBe(1);
		});
	});

	describe('what a user is shown', () => {
		async function seedMatch() {
			const { matchNewWatchToMarketplace } = await import(
				'./marketplace'
			);
			const watches = await seedOpposingWatches();
			await matchNewWatchToMarketplace(watches.wtbWatch);
			return watches;
		}

		async function counterpartIdsFor(watchId: number) {
			const { getMarketplaceViewForWatch } = await import(
				'./marketplace'
			);
			const view = await getMarketplaceViewForWatch(watchId);
			return view?.counterparts.map((c) => c.watch.discordUserId);
		}

		it('shows each side the other', async () => {
			const { wtbWatch, wtsWatch } = await seedMatch();

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual(['200']);
			expect(await counterpartIdsFor(wtsWatch.id)).toEqual(['100']);
		});

		it('keeps a snoozed trader listed and visible to others', async () => {
			const { snoozeWatch } = await import('./watch');
			const { wtbWatch, wtsWatch } = await seedMatch();

			await snoozeWatch(wtsWatch, 6);

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual(['200']);
			expect(await counterpartIdsFor(wtsWatch.id)).toEqual(['100']);
		});

		it('keeps a globally snoozed user visible to others', async () => {
			const prisma = await getPrisma();
			const { wtbWatch } = await seedMatch();

			await prisma.user.update({
				where: { discordUserId: '200' },
				data: { snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) },
			});

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual(['200']);
		});

		it('hides a trader one-way: they stop appearing for you, you still appear for them', async () => {
			const { hideTrader, unhideTrader } = await import('./block');
			const { wtbWatch, wtsWatch } = await seedMatch();

			await hideTrader('100', '200');

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual([]);
			expect(await counterpartIdsFor(wtsWatch.id)).toEqual(['100']);

			await unhideTrader('100', '200');

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual(['200']);
		});

		it('leaves the ledger alone when a trader is hidden, so unhiding restores the match', async () => {
			const { hideTrader } = await import('./block');
			const prisma = await getPrisma();
			await seedMatch();

			await hideTrader('100', '200');

			expect(await prisma.marketplaceMatch.count()).toBe(1);
		});

		it('takes an unlisted watch out of both sides, and puts it back without a new match', async () => {
			const { setWatchListed } = await import('./watch');
			const prisma = await getPrisma();
			const { wtbWatch, wtsWatch } = await seedMatch();

			await setWatchListed(wtbWatch.id, false);

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual([]);
			expect(await counterpartIdsFor(wtsWatch.id)).toEqual([]);

			await setWatchListed(wtbWatch.id, true);

			expect(await counterpartIdsFor(wtbWatch.id)).toEqual(['200']);
			expect(await counterpartIdsFor(wtsWatch.id)).toEqual(['100']);
			expect(await prisma.marketplaceMatch.count()).toBe(1);
		});

		it('drops an ended watch from the counterpart, and shows the ended watch as ended', async () => {
			const { unwatch } = await import('./watch');
			const { getMarketplaceViewForWatch } = await import(
				'./marketplace'
			);
			const { wtbWatch, wtsWatch } = await seedMatch();

			await unwatch(wtbWatch);

			expect(await counterpartIdsFor(wtsWatch.id)).toEqual([]);
			const ended = await getMarketplaceViewForWatch(wtbWatch.id);
			expect(ended?.watch.active).toBe(false);
			expect(ended?.counterparts).toEqual([]);
		});

		it('reports which side has been told, per match', async () => {
			const {
				claimMarketplaceMatchNotification,
				getMarketplaceViewForWatch,
			} = await import('./marketplace');
			const prisma = await getPrisma();
			const { wtbWatch, wtsWatch } = await seedMatch();
			const match = await prisma.marketplaceMatch.findFirstOrThrow();

			await claimMarketplaceMatchNotification(match.id, 'wtb');

			expect(
				(await getMarketplaceViewForWatch(wtbWatch.id))?.counterparts[0]
					.notified,
			).toBe(true);
			expect(
				(await getMarketplaceViewForWatch(wtsWatch.id))?.counterparts[0]
					.notified,
			).toBe(false);
		});

		it("lists a user's unlisted watch with no counterparts, next to a listed one", async () => {
			const { upsertWatch } = await import('./watch');
			const { getMarketplaceViewsForUser } = await import(
				'./marketplace'
			);
			await seedMatch();
			await upsertWatch('100', {
				itemName: 'SHIELD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
				isPublicallyTradeable: false,
			});

			const views = await getMarketplaceViewsForUser('100');

			expect(
				views.map((v) => [
					v.watch.itemName,
					v.watch.isPublicallyTradeable,
					v.counterparts.length,
				]),
			).toEqual([
				['SHIELD', false, 0],
				['SWORD', true, 1],
			]);
		});
	});

	describe('pending digests', () => {
		it('names every watch with a side still to be told, until each side is claimed', async () => {
			const {
				claimMarketplaceMatchNotification,
				getWatchIdsWithPendingMarketplaceMatches,
				matchNewWatchToMarketplace,
			} = await import('./marketplace');
			const prisma = await getPrisma();
			const { wtbWatch, wtsWatch } = await seedOpposingWatches();
			await matchNewWatchToMarketplace(wtbWatch);
			const match = await prisma.marketplaceMatch.findFirstOrThrow();

			expect(
				(await getWatchIdsWithPendingMarketplaceMatches()).sort(),
			).toEqual([wtbWatch.id, wtsWatch.id].sort());

			await claimMarketplaceMatchNotification(match.id, 'wtb');
			expect(await getWatchIdsWithPendingMarketplaceMatches()).toEqual([
				wtsWatch.id,
			]);

			await claimMarketplaceMatchNotification(match.id, 'wts');
			expect(await getWatchIdsWithPendingMarketplaceMatches()).toEqual(
				[],
			);
		});
	});
});
