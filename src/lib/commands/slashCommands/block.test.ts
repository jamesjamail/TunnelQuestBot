import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	addPlayerBlock: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '../../../prisma/client';
import command from './block';
import { addPlayerBlock } from '../../../prisma/dbExecutors/block';
import {
	makeBlockedPlayer,
	makeChatInteraction,
} from '../../../test/factories';

describe('block command', () => {
	it('calls addPlayerBlock and replies with one embed and unblock button', async () => {
		const block = makeBlockedPlayer({ id: 5, player: 'SOANDSO' });
		vi.mocked(addPlayerBlock).mockResolvedValue(block);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					player: { value: 'SOANDSO' },
					server: { value: Server.BLUE },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(addPlayerBlock).toHaveBeenCalledWith(
			'100',
			'SOANDSO',
			Server.BLUE,
		);
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.embeds).toHaveLength(1);
		expect(reply?.components).toHaveLength(1);
		expect(reply?.flags).toBe(MessageFlags.Ephemeral);
	});
});
