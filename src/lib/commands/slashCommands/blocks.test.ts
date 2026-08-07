import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	getPlayerBlocks: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './blocks';
import { getPlayerBlocks } from '../../../prisma/dbExecutors/block';
import { messageCopy } from '../../content/copy/messageCopy';
import {
	makeBlockedPlayer,
	makeChatInteraction,
} from '../../../test/factories';

describe('blocks command', () => {
	beforeEach(() => {
		vi.mocked(getPlayerBlocks).mockReset();
	});

	it('defers and replies with filtered empty copy when there are no blocks', async () => {
		vi.mocked(getPlayerBlocks).mockResolvedValue([]);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'filter' ? { value: 'active' } : null,
		);

		await command.execute(interaction);

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.youDontHaveAnyBlocks('active'),
		);
	});

	it('DMs each block and editReplies with the delivery summary in guilds', async () => {
		const blocks = [
			makeBlockedPlayer({ id: 1 }),
			makeBlockedPlayer({ id: 2 }),
		];
		vi.mocked(getPlayerBlocks).mockResolvedValue(blocks);
		const interaction = makeChatInteraction();
		interaction.user.send = vi.fn(async () => ({ channelId: 'dm-99' }));
		vi.mocked(interaction.inGuild).mockReturnValue(true);

		await command.execute(interaction);

		expect(interaction.user.send).toHaveBeenCalledTimes(2);
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.blocksHaveBeenDeliveredViaDm(2, 'dm-99'),
		);
	});
});
