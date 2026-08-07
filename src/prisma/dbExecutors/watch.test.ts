import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { snoozeWatchByItemName, unsnoozeWatchByItemName } from './watch';
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
