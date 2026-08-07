import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	getPlayerLinksForUser: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '../../../prisma/client';
import command from './links';
import { getPlayerLinksForUser } from '../../../prisma/dbExecutors/playerLink';
import { messageCopy } from '../../content/copy/messageCopy';
import { makeChatInteraction, makePlayerLink } from '../../../test/factories';

describe('links command', () => {
	it('defers first and counts only rendered links', async () => {
		vi.mocked(getPlayerLinksForUser).mockResolvedValue([
			makePlayerLink({ id: 1, server: Server.BLUE }),
			makePlayerLink({ id: 2, server: null as unknown as Server }),
		]);
		const interaction = makeChatInteraction();
		interaction.user.send = vi.fn(async () => ({ channelId: 'dm-55' }));
		vi.mocked(interaction.inGuild).mockReturnValue(true);

		await command.execute(interaction);

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
		expect(interaction.user.send).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.linksHaveBeenDeliveredViaDm(1, 'dm-55'),
		);
	});
});
