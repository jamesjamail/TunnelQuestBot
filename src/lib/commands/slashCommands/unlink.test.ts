import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	removePlayerLink: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '@prisma/client';
import command from './unlink';
import { removePlayerLink } from '../../../prisma/dbExecutors/playerLink';
import { messageCopy } from '../../content/copy/messageCopy';
import { makeChatInteraction } from '../../../test/factories';

describe('unlink command', () => {
	beforeEach(() => {
		vi.mocked(removePlayerLink).mockReset();
	});

	it('replies with success copy when removal succeeds', async () => {
		vi.mocked(removePlayerLink).mockResolvedValue(true);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					player: { value: 'Soandso' },
					server: { value: Server.BLUE },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(removePlayerLink).toHaveBeenCalledWith(
			'100',
			'Soandso',
			Server.BLUE,
		);
		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.soAndSoHasBeenUnlinked({
				player: 'Soandso',
				server: Server.BLUE,
			} as never),
			flags: MessageFlags.Ephemeral,
		});
	});

	it('replies with failure copy when removal fails', async () => {
		vi.mocked(removePlayerLink).mockResolvedValue(false);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					player: { value: 'Soandso' },
					server: { value: Server.BLUE },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.soAndSoHasFailedToBeUnlinked({
				player: 'Soandso',
				server: Server.BLUE,
			} as never),
			flags: MessageFlags.Ephemeral,
		});
	});
});
