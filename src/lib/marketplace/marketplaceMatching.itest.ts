import { vi } from 'vitest';
vi.mock('../..', () => import('../../test/mocks/discordClient'));
vi.mock('../helpers/errors', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../helpers/errors')>();
	return {
		...actual,
		gracefullyHandleError: vi.fn(async () => undefined),
	};
});
vi.mock('./marketplaceDigestMessage', () => ({
	buildMarketplaceDigestMessage: vi.fn(() => ({
		embeds: [{ data: { title: 'digest' } }],
		components: [],
	})),
}));
// 	the real claim, wrapped so a test can inject a failure into one call
vi.mock('../../prisma/dbExecutors/marketplace', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../prisma/dbExecutors/marketplace')
		>();
	return {
		...actual,
		claimMarketplaceMatchNotification: vi.fn(
			actual.claimMarketplaceMatchNotification,
		),
	};
});

import { describe, it, expect } from 'vitest';
import { Server, WatchType } from '../../prisma/client';

async function seedUser(discordUserId: string) {
	const { prisma } = await import('../../prisma/init');
	return prisma.user.create({
		data: { discordUserId, discordUsername: 'tester' },
	});
}

describe('runMarketplaceMatchingSweep (integration)', () => {
	it('releases a partial claim when a later claim fails, so both counterparts stay deliverable', async () => {
		const { upsertWatch } = await import('../../prisma/dbExecutors/watch');
		const marketplace = await import(
			'../../prisma/dbExecutors/marketplace'
		);
		const { runMarketplaceMatchingSweep } = await import(
			'./marketplaceMatching'
		);
		const { client } = await import('../../test/mocks/discordClient');
		const { gracefullyHandleError } = await import('../helpers/errors');
		const { buildMarketplaceDigestMessage } = await import(
			'./marketplaceDigestMessage'
		);
		const { prisma } = await import('../../prisma/init');

		// 	one buyer, two sellers: the buyer's digest has two counterparts
		await seedUser('100');
		await seedUser('200');
		await seedUser('300');
		for (const seller of ['200', '300']) {
			await upsertWatch(seller, {
				itemName: 'SWORD',
				server: Server.BLUE,
				watchType: WatchType.WTS,
				isPublicallyTradeable: true,
			});
		}
		await upsertWatch('100', {
			itemName: 'SWORD',
			server: Server.BLUE,
			watchType: WatchType.WTB,
			isPublicallyTradeable: true,
		});

		// 	the buyer's digest is the only one claiming wtb sides, so failing
		// 	the second wtb claim fails it after its first claim succeeded
		const claim = vi.mocked(marketplace.claimMarketplaceMatchNotification);
		const realClaim = claim.getMockImplementation();
		if (!realClaim) throw new Error('claim is not wrapped');
		let wtbClaims = 0;
		claim.mockImplementation(async (matchId, side) => {
			if (side === 'wtb' && ++wtbClaims === 2) {
				throw new Error('db down');
			}
			return realClaim(matchId, side);
		});
		vi.mocked(client.users.send).mockClear();

		await runMarketplaceMatchingSweep();

		expect(await prisma.marketplaceMatch.count()).toBe(2);
		expect(
			await prisma.marketplaceMatch.count({
				where: { wtbNotifiedAt: { not: null } },
			}),
		).toBe(0);
		expect(client.users.send).not.toHaveBeenCalledWith(
			'100',
			expect.anything(),
		);
		expect(gracefullyHandleError).toHaveBeenCalledWith(
			expect.objectContaining({ message: 'db down' }),
		);

		claim.mockImplementation(realClaim);
		vi.mocked(client.users.send).mockClear();
		vi.mocked(buildMarketplaceDigestMessage).mockClear();

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(1);
		expect(client.users.send).toHaveBeenCalledWith(
			'100',
			expect.anything(),
		);
		const [[, counterparts]] = vi.mocked(buildMarketplaceDigestMessage).mock
			.calls;
		expect(
			counterparts.map((counterpart) => counterpart.watch.discordUserId),
		).toEqual(expect.arrayContaining(['200', '300']));
		expect(counterparts).toHaveLength(2);
		expect(
			await prisma.marketplaceMatch.count({
				where: { wtbNotifiedAt: null },
			}),
		).toBe(0);
	});
});
