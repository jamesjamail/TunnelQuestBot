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

function makeInteraction(userId = '100') {
	return { user: { id: userId, username: 'tester' } } as never;
}

const defaultWatchData = {
	itemName: 'SWORD',
	server: Server.BLUE,
	watchType: WatchType.WTB,
};

describe('watch dbExecutor (integration)', () => {
	describe('upsertWatch', () => {
		it('upserting the same key twice yields one row with updated fields', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				priceRequirement: 500,
				notes: 'updated',
			});

			expect(await prisma.watch.count()).toBe(1);
			const row = await prisma.watch.findFirst();
			expect(row?.priceRequirement).toBe(500);
			expect(row?.notes).toBe('updated');
			expect(row?.active).toBe(true);
		});

		it('changing discordUserId yields a second row', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('100', defaultWatchData);
			await upsertWatch('200', defaultWatchData);

			expect(await prisma.watch.count()).toBe(2);
		});

		it('changing itemName yields a second row', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});

			expect(await prisma.watch.count()).toBe(2);
		});

		it('stores known aliases under their canonical item name', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			const watch = await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'FBSS',
			});

			expect(watch.itemName).toBe('FLOWING BLACK SILK SASH');
			expect(await prisma.watch.count()).toBe(1);
		});

		it('treats alias and canonical names as the same watch key', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'FBSS',
				priceRequirement: 600,
			});
			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'FLOWING BLACK SILK SASH',
				priceRequirement: 500,
			});

			expect(await prisma.watch.count()).toBe(1);
			const row = await prisma.watch.findFirst();
			expect(row?.itemName).toBe('FLOWING BLACK SILK SASH');
			expect(row?.priceRequirement).toBe(500);
		});

		it('changing server yields a second row', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				server: Server.GREEN,
			});

			expect(await prisma.watch.count()).toBe(2);
		});

		it('changing watchType yields a second row', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				watchType: WatchType.WTS,
			});

			expect(await prisma.watch.count()).toBe(2);
		});

		it('rejects itemName longer than 255 characters', async () => {
			const { upsertWatch } = await import('./watch');
			await seedUser();

			await expect(
				upsertWatch('100', {
					...defaultWatchData,
					itemName: 'X'.repeat(256),
				}),
			).rejects.toThrow();
		});

		it('defaults active to true and created to a timestamp on insert', async () => {
			const { upsertWatch } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();
			const before = Date.now();

			await upsertWatch('100', defaultWatchData);

			const row = await prisma.watch.findFirstOrThrow();
			expect(row.active).toBe(true);
			expect(row.created.getTime()).toBeGreaterThanOrEqual(before);
			expect(row.created.getTime()).toBeLessThanOrEqual(Date.now());
		});
	});

	describe('queries', () => {
		it('getWatchesByUser returns only that user active watches', async () => {
			const { upsertWatch, getWatchesByUser, unwatch } = await import(
				'./watch'
			);
			await seedUser('100');
			await seedUser('200');

			const watch1 = await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});
			await upsertWatch('200', defaultWatchData);
			await unwatch({ id: watch1.id });

			const watches = await getWatchesByUser('100');
			expect(watches).toHaveLength(1);
			expect(watches[0].itemName).toBe('SHIELD');
		});

		it('getWatchesByItemName filters by substring on stored uppercase names', async () => {
			const { upsertWatch, getWatchesByItemName } = await import(
				'./watch'
			);
			await seedUser();

			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'MAGIC SWORD',
			});
			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});

			expect(await getWatchesByItemName('100', 'SWORD')).toHaveLength(1);
			expect(await getWatchesByItemName('100', '')).toHaveLength(2);
		});

		it('getWatchByWatchId throws when the watch is missing', async () => {
			const { getWatchByWatchId } = await import('./watch');

			await expect(getWatchByWatchId(99999)).rejects.toThrow(
				'Error querying db for watch id 99999',
			);
		});

		it('getWatchByWatchIdForWatchNotification includes user and blockedWatches', async () => {
			const { upsertWatch, getWatchByWatchIdForWatchNotification } =
				await import('./watch');
			const { addPlayerBlockByWatch } = await import('./block');
			await seedUser();

			const watch = await upsertWatch('100', defaultWatchData);
			await addPlayerBlockByWatch('100', watch.id, 'BadGuy');

			const result = await getWatchByWatchIdForWatchNotification(
				watch.id,
			);
			expect(result).not.toBeNull();
			expect(result!.user.discordUserId).toBe('100');
			expect(result!.blockedWatches).toHaveLength(1);
		});

		it('getWatchByWatchIdForWatchNotification returns null for a missing id', async () => {
			const { getWatchByWatchIdForWatchNotification } = await import(
				'./watch'
			);

			expect(
				await getWatchByWatchIdForWatchNotification(99999),
			).toBeNull();
		});
	});

	describe('soft delete vs hard delete', () => {
		it('unwatch soft-deletes while deleteWatchesOlderThanWatchdurationDays hard-deletes', async () => {
			const {
				upsertWatch,
				unwatch,
				deleteWatchesOlderThanWatchdurationDays,
			} = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			const soft = await upsertWatch('100', defaultWatchData);
			const hard = await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});

			await unwatch({ id: soft.id });

			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 30);
			await prisma.watch.update({
				where: { id: hard.id },
				data: { created: oldDate },
			});

			await deleteWatchesOlderThanWatchdurationDays();

			expect(
				await prisma.watch.findUnique({ where: { id: soft.id } }),
			).toMatchObject({
				active: false,
			});
			expect(
				await prisma.watch.findUnique({ where: { id: hard.id } }),
			).toBeNull();
		});
	});

	describe('watch lifecycle helpers', () => {
		it('setWatchActiveByWatchId reactivates an inactive watch', async () => {
			const { upsertWatch, unwatch, setWatchActiveByWatchId } =
				await import('./watch');
			await seedUser();

			const watch = await upsertWatch('100', defaultWatchData);
			await unwatch({ id: watch.id });
			const reactivated = await setWatchActiveByWatchId(watch.id);

			expect(reactivated.active).toBe(true);
			expect(reactivated.snoozedUntil).toBeNull();
		});

		it('snoozeWatch and unsnoozeWatch set and clear snoozedUntil', async () => {
			const { upsertWatch, snoozeWatch, unsnoozeWatch } = await import(
				'./watch'
			);
			await seedUser();

			const watch = await upsertWatch('100', defaultWatchData);
			const snoozed = await snoozeWatch(watch, 2);
			expect(snoozed.snoozedUntil).not.toBeNull();
			expect(snoozed.snoozedUntil!.getTime()).toBeGreaterThan(Date.now());

			const unsnoozed = await unsnoozeWatch(snoozed);
			expect(unsnoozed.snoozedUntil).toBeNull();
		});

		it('snoozeAllWatches sets User.snoozedUntil', async () => {
			const { upsertWatch, snoozeAllWatches } = await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await snoozeAllWatches('100');

			const user = await prisma.user.findUniqueOrThrow({
				where: { discordUserId: '100' },
			});
			expect(user.snoozedUntil).not.toBeNull();
			expect(user.snoozedUntil!.getTime()).toBeGreaterThan(Date.now());
		});

		it('extendWatch moves created forward and reactivates', async () => {
			const { upsertWatch, unwatch, extendWatch } = await import(
				'./watch'
			);
			await seedUser();

			const watch = await upsertWatch('100', defaultWatchData);
			const originalCreated = watch.created;
			await unwatch({ id: watch.id });

			await new Promise((r) => setTimeout(r, 10));
			const extended = await extendWatch({ id: watch.id });

			expect(extended.created.getTime()).toBeGreaterThan(
				originalCreated.getTime(),
			);
			expect(extended.active).toBe(true);
		});
	});

	describe('extendAllWatchesAndReturnWatches', () => {
		it('does not resurrect inactive watches', async () => {
			const { upsertWatch, unwatch, extendAllWatchesAndReturnWatches } =
				await import('./watch');
			const prisma = await getPrisma();
			await seedUser();

			const active = await upsertWatch('100', defaultWatchData);
			const inactive = await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});
			await unwatch({ id: inactive.id });

			const watches = await extendAllWatchesAndReturnWatches('100');

			expect(watches).toHaveLength(1);
			expect(watches[0].id).toBe(active.id);
			const stillInactive = await prisma.watch.findUniqueOrThrow({
				where: { id: inactive.id },
			});
			expect(stillInactive.active).toBe(false);
		});

		it('clears User.snoozedUntil and does not touch another user watches', async () => {
			const {
				upsertWatch,
				snoozeAllWatches,
				extendAllWatchesAndReturnWatches,
			} = await import('./watch');
			const prisma = await getPrisma();
			await seedUser('100');
			await seedUser('200');

			await upsertWatch('100', defaultWatchData);
			const otherWatch = await upsertWatch('200', defaultWatchData);
			const otherCreated = otherWatch.created;

			await snoozeAllWatches('100');
			await extendAllWatchesAndReturnWatches('100');

			const user = await prisma.user.findUniqueOrThrow({
				where: { discordUserId: '100' },
			});
			expect(user.snoozedUntil).toBeNull();

			const untouched = await prisma.watch.findUniqueOrThrow({
				where: { id: otherWatch.id },
			});
			expect(untouched.created.getTime()).toBe(otherCreated.getTime());
		});
	});

	describe('extendAllWatchesAndReturnUserAndWatches', () => {
		it('returns both the updated user and active watches', async () => {
			const {
				upsertWatch,
				snoozeAllWatches,
				extendAllWatchesAndReturnUserAndWatches,
			} = await import('./watch');
			await seedUser();

			await upsertWatch('100', defaultWatchData);
			await snoozeAllWatches('100');

			const { user, watches } =
				await extendAllWatchesAndReturnUserAndWatches('100');

			expect(user.snoozedUntil).toBeNull();
			expect(watches).toHaveLength(1);
		});
	});

	describe('getSnoozedWatchesByDiscordUser', () => {
		it('returns only watches with a future snoozedUntil', async () => {
			const { upsertWatch, snoozeWatch, getSnoozedWatchesByDiscordUser } =
				await import('./watch');
			await seedUser();

			const snoozed = await upsertWatch('100', defaultWatchData);
			await upsertWatch('100', {
				...defaultWatchData,
				itemName: 'SHIELD',
			});
			await snoozeWatch(snoozed, 2);

			const user = { id: '100' } as never;
			const result = await getSnoozedWatchesByDiscordUser(user);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(snoozed.id);
		});
	});

	describe('by-item-name commands', () => {
		it('unsnoozeWatchByItemName throws when the watch does not exist', async () => {
			const { unsnoozeWatchByItemName } = await import('./watch');

			await expect(
				unsnoozeWatchByItemName(makeInteraction(), 'MISSING'),
			).rejects.toThrow();
		});

		it('snoozeWatchByItemName throws when the watch does not exist', async () => {
			const { snoozeWatchByItemName } = await import('./watch');

			await expect(
				snoozeWatchByItemName(makeInteraction(), 'MISSING'),
			).rejects.toThrow();
		});

		it('unwatchByWatchName throws when the watch does not exist', async () => {
			const { unwatchByWatchName } = await import('./watch');

			await expect(
				unwatchByWatchName(makeInteraction(), 'MISSING'),
			).rejects.toThrow();
		});
	});
});
