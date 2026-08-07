import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));

import { describe, it, expect } from 'vitest';
import { Server, WatchType } from './client';

async function getPrisma() {
	const { prisma } = await import('./init');
	return prisma;
}

function makeInteraction(userId = '999', username = 'newbie') {
	return { user: { id: userId, username } } as never;
}

describe('attemptAndCreateUserIfNeeded (integration)', () => {
	it('creates the user and retries when a watch insert hits P2003', async () => {
		const { attemptAndCreateUserIfNeeded } =
			await import('./higherOrderFunctions');
		const { upsertWatch } = await import('./dbExecutors/watch');
		const prisma = await getPrisma();

		await attemptAndCreateUserIfNeeded(makeInteraction('999'), () =>
			upsertWatch('999', {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTB,
			}),
		);

		expect(
			await prisma.user.count({ where: { discordUserId: '999' } }),
		).toBe(1);
		expect(
			await prisma.watch.count({ where: { discordUserId: '999' } }),
		).toBe(1);
	});

	it('runs once without creating a duplicate user when the user already exists', async () => {
		const { attemptAndCreateUserIfNeeded } =
			await import('./higherOrderFunctions');
		const { upsertWatch } = await import('./dbExecutors/watch');
		const prisma = await getPrisma();

		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'tester' },
		});

		await attemptAndCreateUserIfNeeded(
			makeInteraction('100', 'tester'),
			() =>
				upsertWatch('100', {
					itemName: 'SWORD',
					server: Server.BLUE,
					watchType: WatchType.WTB,
				}),
		);

		expect(await prisma.user.count()).toBe(1);
		expect(await prisma.watch.count()).toBe(1);
	});

	it('rethrows P2002 unique violations without creating a user', async () => {
		const { attemptAndCreateUserIfNeeded } =
			await import('./higherOrderFunctions');
		const prisma = await getPrisma();

		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'tester' },
		});
		await prisma.user.create({
			data: { discordUserId: '200', discordUsername: 'other' },
		});
		await prisma.playerLink.create({
			data: {
				discordUserId: '100',
				server: Server.BLUE,
				player: 'HERO',
			},
		});

		await expect(
			attemptAndCreateUserIfNeeded(makeInteraction('200', 'other'), () =>
				prisma.playerLink.create({
					data: {
						discordUserId: '200',
						server: Server.BLUE,
						player: 'HERO',
					},
				}),
			),
		).rejects.toMatchObject({ code: 'P2002' });

		expect(await prisma.user.count()).toBe(2);
	});

	it('rethrows P2003 when the violated constraint is not discordUserId', async () => {
		const { attemptAndCreateUserIfNeeded } =
			await import('./higherOrderFunctions');
		const prisma = await getPrisma();

		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'tester' },
		});

		await expect(
			attemptAndCreateUserIfNeeded(makeInteraction('100', 'tester'), () =>
				prisma.blockedPlayerByWatch.create({
					data: {
						discordUserId: '100',
						watchId: 99999,
						player: 'BadGuy',
					},
				}),
			),
		).rejects.toMatchObject({ code: 'P2003' });

		expect(await prisma.user.count()).toBe(1);
	});
});
