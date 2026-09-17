import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import {
	snoozeWatchByItemName,
	unsnoozeWatchByItemName,
	unwatch,
	unwatchByWatchName,
	unwatchAllWatches,
} from './watch';
import { prisma } from '../../test/mocks/prisma';
import { makeChatInteraction, makeWatch } from '../../test/factories';

describe('watch item name lookups', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.findFirstOrThrow).mockResolvedValue(
			makeWatch({ id: 7 }),
		);
		vi.mocked(prisma.watch.update).mockResolvedValue(makeWatch({ id: 7 }));
	});

	it('snoozeWatchByItemName resolves aliases to canonical item names', async () => {
		const interaction = makeChatInteraction();
		await snoozeWatchByItemName(interaction, 'fbss');

		expect(prisma.watch.findFirstOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					itemName: 'FLOWING BLACK SILK SASH',
				}),
			}),
		);
	});

	it('unsnoozeWatchByItemName resolves aliases to canonical item names', async () => {
		const interaction = makeChatInteraction();
		await unsnoozeWatchByItemName(interaction, 'fbss');

		expect(prisma.watch.findFirstOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					itemName: 'FLOWING BLACK SILK SASH',
				}),
			}),
		);
	});
});

describe('deactivating a watch clears its marketplace matches', () => {
	beforeEach(() => {
		vi.mocked(prisma.watch.update).mockResolvedValue(makeWatch({ id: 7 }));
		vi.mocked(prisma.watch.findFirstOrThrow).mockResolvedValue(
			makeWatch({ id: 7 }),
		);
		vi.mocked(prisma.watch.findMany).mockResolvedValue([
			makeWatch({ id: 7 }),
			makeWatch({ id: 8 }),
		]);
	});

	// 	Regression test: MarketplaceMatch has a unique constraint on
	// 	[wtbWatchId, wtsWatchId] and, once notified, is never re-fetched as
	// 	"unnotified". If a stale match row survives a watch going inactive,
	// 	reactivating that same watch id can never match (or notify) again -
	// 	the create silently no-ops on the unique constraint.
	it('unwatch deletes matches referencing the watch id', async () => {
		await unwatch({ id: 7 });

		expect(prisma.marketplaceMatch.deleteMany).toHaveBeenCalledWith({
			where: {
				OR: [{ wtbWatchId: { in: [7] } }, { wtsWatchId: { in: [7] } }],
			},
		});
	});

	it('unwatchByWatchName deletes matches referencing the watch id', async () => {
		const interaction = makeChatInteraction();
		await unwatchByWatchName(interaction, 'fbss');

		expect(prisma.marketplaceMatch.deleteMany).toHaveBeenCalledWith({
			where: {
				OR: [{ wtbWatchId: { in: [7] } }, { wtsWatchId: { in: [7] } }],
			},
		});
	});

	it('unwatchAllWatches deletes matches referencing every deactivated watch id', async () => {
		const interaction = makeChatInteraction();
		await unwatchAllWatches(interaction);

		expect(prisma.marketplaceMatch.deleteMany).toHaveBeenCalledWith({
			where: {
				OR: [
					{ wtbWatchId: { in: [7, 8] } },
					{ wtsWatchId: { in: [7, 8] } },
				],
			},
		});
	});
});
