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

async function seedWatch(discordUserId = '100') {
	const { upsertWatch } = await import('./watch');
	await seedUser(discordUserId);
	return upsertWatch(discordUserId, {
		itemName: 'SWORD',
		server: Server.BLUE,
		watchType: WatchType.WTB,
	});
}

describe('block dbExecutor (integration)', () => {
	describe('addPlayerBlock', () => {
		it('upserting the same player twice yields one row', async () => {
			const { addPlayerBlock } = await import('./block');
			const prisma = await getPrisma();
			await seedUser();

			await addPlayerBlock('100', 'BadGuy', Server.BLUE);
			await addPlayerBlock('100', 'badguy', Server.BLUE);

			expect(await prisma.blockedPlayer.count()).toBe(1);
		});

		it('the same player on a different server yields two rows', async () => {
			const { addPlayerBlock } = await import('./block');
			const prisma = await getPrisma();
			await seedUser();

			await addPlayerBlock('100', 'BadGuy', Server.BLUE);
			await addPlayerBlock('100', 'BadGuy', Server.GREEN);

			expect(await prisma.blockedPlayer.count()).toBe(2);
		});
	});

	describe('soft delete player blocks', () => {
		it('removePlayerBlockById soft-deletes and restorePlayerBlockById reactivates', async () => {
			const {
				addPlayerBlock,
				removePlayerBlockById,
				restorePlayerBlockById,
			} = await import('./block');
			const prisma = await getPrisma();
			await seedUser();

			const block = await addPlayerBlock('100', 'BadGuy', Server.BLUE);
			await removePlayerBlockById(block.id);

			let row = await prisma.blockedPlayer.findUniqueOrThrow({
				where: { id: block.id },
			});
			expect(row.active).toBe(false);

			await restorePlayerBlockById(block.id);
			row = await prisma.blockedPlayer.findUniqueOrThrow({
				where: { id: block.id },
			});
			expect(row.active).toBe(true);
		});

		it('getPlayerBlocks excludes inactive blocks', async () => {
			const { addPlayerBlock, removePlayerBlockById, getPlayerBlocks } =
				await import('./block');
			await seedUser();

			const block = await addPlayerBlock('100', 'BadGuy', Server.BLUE);
			await addPlayerBlock('100', 'OtherGuy', Server.BLUE);
			await removePlayerBlockById(block.id);

			const blocks = await getPlayerBlocks('100');
			expect(blocks).toHaveLength(1);
			expect(blocks[0].player).toBe('OTHERGUY');
		});
	});

	describe('watch blocks', () => {
		it('addPlayerBlockByWatch twice for the same watch and player yields one row', async () => {
			const { addPlayerBlockByWatch } = await import('./block');
			const prisma = await getPrisma();
			const watch = await seedWatch();

			await addPlayerBlockByWatch('100', watch.id, 'BadGuy');
			await addPlayerBlockByWatch('100', watch.id, 'badguy');

			expect(await prisma.blockedPlayerByWatch.count()).toBe(1);
		});

		it('cascades BlockedPlayerByWatch when the watch is hard-deleted', async () => {
			const { addPlayerBlockByWatch } = await import('./block');
			const prisma = await getPrisma();
			const watch = await seedWatch();

			await addPlayerBlockByWatch('100', watch.id, 'BadGuy');
			expect(await prisma.blockedPlayerByWatch.count()).toBe(1);

			await prisma.watch.delete({ where: { id: watch.id } });

			expect(await prisma.blockedPlayerByWatch.count()).toBe(0);
		});

		it('removeWatchBlockByPlayerName removes only the matching player row', async () => {
			const { addPlayerBlockByWatch, removeWatchBlockByPlayerName } =
				await import('./block');
			const prisma = await getPrisma();
			const watch = await seedWatch();

			await addPlayerBlockByWatch('100', watch.id, 'BadGuy');
			await addPlayerBlockByWatch('100', watch.id, 'OtherGuy');

			await removeWatchBlockByPlayerName(watch.id, 'BadGuy');

			const remaining = await prisma.blockedPlayerByWatch.findMany();
			expect(remaining).toHaveLength(1);
			expect(remaining[0].player).toBe('OTHERGUY');
		});
	});

	describe('user deletion', () => {
		it('deleting a User who still has watches raises a foreign-key error', async () => {
			const prisma = await getPrisma();
			await seedWatch();

			await expect(
				prisma.user.delete({ where: { discordUserId: '100' } }),
			).rejects.toThrow(/Watch_discordUserId_fkey/);
		});
	});
});
