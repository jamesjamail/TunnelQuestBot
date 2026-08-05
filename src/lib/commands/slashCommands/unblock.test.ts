import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	removePlayerBlockById: vi.fn(),
	removePlayerBlockWithoutServer: vi.fn(),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '@prisma/client';
import command from './unblock';
import {
	removePlayerBlockById,
	removePlayerBlockWithoutServer,
} from '../../../prisma/dbExecutors/block';
import { prefixJSON } from '../autocomplete/autocompleteHelpers';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';
import {
	makeBlockedPlayer,
	makeChatInteraction,
} from '../../../test/factories';

describe('unblock command', () => {
	beforeEach(() => {
		vi.mocked(removePlayerBlockById).mockReset();
		vi.mocked(removePlayerBlockWithoutServer).mockReset();
	});

	it('uses removePlayerBlockById for auto-suggestion and backfills metadata', async () => {
		const block = makeBlockedPlayer({
			id: 9,
			player: 'SOANDSO',
			server: Server.BLUE,
		});
		vi.mocked(removePlayerBlockById).mockResolvedValue(block);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'player'
				? {
						value: prefixJSON(
							JSON.stringify({ blockedPlayer: { id: 9 } }),
						),
					}
				: null,
		);

		await command.execute(interaction);

		expect(removePlayerBlockById).toHaveBeenCalledWith(9);
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.content).toBe(messageCopy.soAndSoHasBeenUnblocked(block));
		expect(reply?.embeds).toHaveLength(1);
		expect(reply?.components).toHaveLength(1);
		expect(reply?.flags).toBe(MessageFlags.Ephemeral);
	});

	it('uses removePlayerBlockWithoutServer for a raw player name', async () => {
		const block = makeBlockedPlayer({ id: 2, player: 'SOANDSO' });
		vi.mocked(removePlayerBlockWithoutServer).mockResolvedValue(block);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'player' ? { value: 'SOANDSO' } : null,
		);

		await command.execute(interaction);

		expect(removePlayerBlockWithoutServer).toHaveBeenCalledWith(
			interaction,
			'SOANDSO',
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: messageCopy.soAndSoHasBeenUnblocked(block),
			}),
		);
	});

	it('routes not-found throws on the raw-name path to gracefullyHandleError', async () => {
		const error = new Error('block not found');
		vi.mocked(removePlayerBlockWithoutServer).mockRejectedValue(error);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'player' ? { value: 'MISSING' } : null,
		);

		await command.execute(interaction);

		expect(gracefullyHandleError).toHaveBeenCalledWith(
			error,
			interaction,
			command,
		);
	});
});
