import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchesByItemName: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './watches';
import { getWatchesByItemName } from '../../../prisma/dbExecutors/watch';
import { messageCopy } from '../../content/copy/messageCopy';
import { makeChatInteraction, makeWatch } from '../../../test/factories';

describe('watches command', () => {
	it('editReplies with empty copy in guilds when there are no watches', async () => {
		vi.mocked(getWatchesByItemName).mockResolvedValue([]);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.inGuild).mockReturnValue(true);

		await command.execute(interaction);

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.youDontHaveAnyWatches,
		);
	});

	it('editReplies with empty copy in DMs when there are no watches', async () => {
		vi.mocked(getWatchesByItemName).mockResolvedValue([]);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.inGuild).mockReturnValue(false);

		await command.execute(interaction);

		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.youDontHaveAnyWatches,
		);
	});

	it('DMs each watch and editReplies with delivery summary in guilds', async () => {
		vi.mocked(getWatchesByItemName).mockResolvedValue([
			makeWatch({ id: 1 }),
			makeWatch({ id: 2 }),
		]);
		const interaction = makeChatInteraction();
		interaction.user.send = vi.fn(async () => ({ channelId: 'dm-77' }));
		vi.mocked(interaction.inGuild).mockReturnValue(true);

		await command.execute(interaction);

		expect(interaction.user.send).toHaveBeenCalledTimes(2);
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.watchesHaveBeenDeliveredViaDm(2, 'dm-77'),
		);
	});

	it('editReplies with Here you go in DMs when watches exist', async () => {
		vi.mocked(getWatchesByItemName).mockResolvedValue([makeWatch()]);
		const interaction = makeChatInteraction();
		interaction.user.send = vi.fn(async () => ({ channelId: 'dm-77' }));
		vi.mocked(interaction.inGuild).mockReturnValue(false);

		await command.execute(interaction);

		expect(interaction.editReply).toHaveBeenCalledWith('Here you go...');
	});
});
