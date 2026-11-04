import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	addTraderBlock: vi.fn(),
}));
vi.mock('../../../prisma/dbExecutors/user', () => ({
	findOrCreateUser: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './blocktrader';
import { addTraderBlock } from '../../../prisma/dbExecutors/block';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import { makeChatInteraction } from '../../../test/factories';

function interactionTargeting(targetId: string) {
	return makeChatInteraction({
		options: { getUser: vi.fn(() => ({ id: targetId })) },
	});
}

describe('blocktrader command', () => {
	it('records the block against the caller and replies ephemerally', async () => {
		const interaction = interactionTargeting('200');

		await command.execute(interaction);

		expect(findOrCreateUser).toHaveBeenCalledWith(interaction.user);
		expect(addTraderBlock).toHaveBeenCalledWith('100', '200');
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply).toMatchObject({
			content: expect.stringContaining('<@200>'),
			flags: MessageFlags.Ephemeral,
		});
	});

	it('refuses to block yourself', async () => {
		const interaction = interactionTargeting('100');

		await command.execute(interaction);

		expect(addTraderBlock).not.toHaveBeenCalled();
		expect(vi.mocked(interaction.reply).mock.calls[0][0]).toMatchObject({
			flags: MessageFlags.Ephemeral,
		});
	});
});
