import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect } from 'vitest';

async function getPrisma() {
	const { prisma } = await import('../init');
	return prisma;
}

describe('findOrCreateUser (integration)', () => {
	it('inserts a row readable by findUnique', async () => {
		const { findOrCreateUser } = await import('./user');
		const prisma = await getPrisma();
		const discordUser = { id: '100', username: 'tester' } as never;
		await findOrCreateUser(discordUser);

		const row = await prisma.user.findUnique({
			where: { discordUserId: '100' },
		});
		expect(row?.discordUsername).toBe('tester');
	});

	it('upserts the same user without creating a duplicate', async () => {
		const { findOrCreateUser } = await import('./user');
		const prisma = await getPrisma();
		const discordUser = { id: '100', username: 'tester' } as never;
		await findOrCreateUser(discordUser);
		await findOrCreateUser(discordUser);

		expect(await prisma.user.count()).toBe(1);
	});

	it('starts each test with an empty User table', async () => {
		const { findOrCreateUser } = await import('./user');
		const prisma = await getPrisma();
		const discordUser = { id: '100', username: 'tester' } as never;
		await findOrCreateUser(discordUser);
		expect(await prisma.user.count()).toBe(1);
	});
});

describe('truncation between tests', () => {
	it('User table is empty at the start of this test', async () => {
		const prisma = await getPrisma();
		expect(await prisma.user.count()).toBe(0);
	});
});
