import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '@prisma/client';
import { addPlayerBlock, removePlayerBlockWithoutServer } from './block';
import { prisma } from '../../test/mocks/prisma';
import { makeBlockedPlayer, makeChatInteraction } from '../../test/factories';

describe('addPlayerBlock', () => {
	beforeEach(() => {
		vi.mocked(prisma.blockedPlayer.upsert).mockResolvedValue(
			makeBlockedPlayer(),
		);
	});

	it('reactivates a previously soft-deleted block on upsert update', async () => {
		await addPlayerBlock('100', 'soandso', Server.BLUE);

		expect(prisma.blockedPlayer.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				update: expect.objectContaining({ active: true }),
			}),
		);
	});
});

describe('removePlayerBlockWithoutServer', () => {
	it('queries blocked players using an uppercased player name', async () => {
		vi.mocked(prisma.blockedPlayer.findFirstOrThrow).mockResolvedValue(
			makeBlockedPlayer({ id: 5 }),
		);
		vi.mocked(prisma.blockedPlayer.update).mockResolvedValue(
			makeBlockedPlayer({ id: 5, active: false }),
		);

		const interaction = makeChatInteraction();
		await removePlayerBlockWithoutServer(interaction, 'soandso');

		expect(prisma.blockedPlayer.findFirstOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ player: 'SOANDSO' }),
			}),
		);
	});
});
