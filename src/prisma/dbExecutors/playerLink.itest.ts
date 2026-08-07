import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect } from 'vitest';
import { Server } from '../client';

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

describe('playerLink dbExecutor (integration)', () => {
	describe('insertPlayerLinkSafely', () => {
		it('creates a pending row with linkCode, future expiry, and null server/player', async () => {
			const { insertPlayerLinkSafely } = await import('./playerLink');
			const prisma = await getPrisma();

			const linkCode = await insertPlayerLinkSafely(makeInteraction());

			const row = await prisma.playerLink.findFirstOrThrow({
				where: { linkCode },
			});
			expect(row.server).toBeNull();
			expect(row.player).toBeNull();
			expect(row.linkCodeExpiry).not.toBeNull();
			expect(row.linkCodeExpiry!.getTime()).toBeGreaterThan(Date.now());
		});

		it('allows two pending link rows for the same user', async () => {
			const { insertPlayerLink } = await import('./playerLink');
			const prisma = await getPrisma();
			await seedUser();

			await insertPlayerLink('100');
			await insertPlayerLink('100');

			expect(
				await prisma.playerLink.count({
					where: { discordUserId: '100' },
				}),
			).toBe(2);
		});
	});

	describe('authPlayerLink', () => {
		it('links a valid code by setting server/player and clearing code fields', async () => {
			const { insertPlayerLink, authPlayerLink } = await import(
				'./playerLink'
			);
			await seedUser();

			const linkCode = await insertPlayerLink('100');
			const linked = await authPlayerLink('Hero', Server.BLUE, linkCode);

			expect(linked).toMatchObject({
				discordUserId: '100',
				server: Server.BLUE,
				player: 'Hero',
				linkCode: null,
				linkCodeExpiry: null,
			});
		});

		it('rejects a second user linking the same server/player with P2002', async () => {
			const { insertPlayerLink, authPlayerLink } = await import(
				'./playerLink'
			);
			const prisma = await getPrisma();
			await seedUser('100');
			await seedUser('200');

			const firstCode = await insertPlayerLink('100');
			await authPlayerLink('Hero', Server.BLUE, firstCode);

			const secondCode = await insertPlayerLink('200');
			const pending = await prisma.playerLink.findFirstOrThrow({
				where: { linkCode: secondCode },
			});

			try {
				await prisma.playerLink.update({
					where: { id: pending.id },
					data: {
						server: Server.BLUE,
						player: 'Hero',
						linkCode: null,
						linkCodeExpiry: null,
					},
				});
				expect.fail('expected unique constraint violation');
			} catch (error) {
				expect(error).toMatchObject({ code: 'P2002' });
			}

			expect(
				await authPlayerLink('Hero', Server.BLUE, secondCode),
			).toBeUndefined();
		});

		it('allows one user to link two different characters', async () => {
			const { insertPlayerLink, authPlayerLink, getPlayerLinksForUser } =
				await import('./playerLink');
			await seedUser();

			const code1 = await insertPlayerLink('100');
			const code2 = await insertPlayerLink('100');
			await authPlayerLink('Hero', Server.BLUE, code1);
			await authPlayerLink('Mage', Server.GREEN, code2);

			const links = await getPlayerLinksForUser('100');
			expect(links).toHaveLength(2);
		});

		it('does not link when linkCodeExpiry is in the past', async () => {
			const { insertPlayerLink, authPlayerLink } = await import(
				'./playerLink'
			);
			const prisma = await getPrisma();
			await seedUser();

			const linkCode = await insertPlayerLink('100');
			await prisma.playerLink.updateMany({
				where: { linkCode },
				data: { linkCodeExpiry: new Date(Date.now() - 60_000) },
			});

			expect(
				await authPlayerLink('Hero', Server.BLUE, linkCode),
			).toBeUndefined();
		});
	});

	describe('queries and removal', () => {
		it('getPlayerLinksForUser returns only that user links', async () => {
			const { insertPlayerLink, getPlayerLinksForUser } = await import(
				'./playerLink'
			);
			await seedUser('100');
			await seedUser('200');

			await insertPlayerLink('100');
			await insertPlayerLink('200');

			expect(await getPlayerLinksForUser('100')).toHaveLength(1);
		});

		it('getPlayerLink returns null for an unlinked character', async () => {
			const { getPlayerLink } = await import('./playerLink');

			expect(await getPlayerLink('Nobody', Server.BLUE)).toBeNull();
		});

		it('removePlayerLinkById and removePlayerLink delete rows; insertPlayerLinkFull re-inserts', async () => {
			const {
				insertPlayerLink,
				authPlayerLink,
				removePlayerLinkById,
				removePlayerLink,
				insertPlayerLinkFull,
			} = await import('./playerLink');
			const prisma = await getPrisma();
			await seedUser();

			const linkCode = await insertPlayerLink('100');
			const linked = (await authPlayerLink(
				'Hero',
				Server.BLUE,
				linkCode,
			))!;

			expect(await removePlayerLinkById(linked.id)).toBe(true);
			expect(await prisma.playerLink.count()).toBe(0);

			await insertPlayerLinkFull(linked);
			expect(await prisma.playerLink.count()).toBe(1);

			expect(await removePlayerLink('100', 'Hero', Server.BLUE)).toBe(
				true,
			);
			expect(await prisma.playerLink.count()).toBe(0);
		});
	});
});
