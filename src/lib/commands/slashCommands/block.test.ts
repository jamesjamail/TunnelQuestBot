import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	addPlayerBlock: vi.fn(),
}));

import { afterEach, describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '../../../prisma/client';
import command from './block';
import { addPlayerBlock } from '../../../prisma/dbExecutors/block';
import {
	makeAutocompleteInteraction,
	makeBlockedPlayer,
	makeChatInteraction,
} from '../../../test/factories';
import { resetConfigCache } from '../../../config';

const redClassic = process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
const redEmbedded = process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;

afterEach(() => {
	process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID = redClassic;
	process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID = redEmbedded;
	resetConfigCache();
});

describe('block command', () => {
	it('uses autocomplete rather than static choices for the server option', () => {
		const serverOption = command.command
			.toJSON()
			.options?.find((option) => option.name === 'server');

		expect(serverOption).toMatchObject({ autocomplete: true });
		expect(serverOption?.choices).toBeUndefined();
	});

	it('autocompletes only enabled servers', async () => {
		delete process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		resetConfigCache();
		const interaction = makeAutocompleteInteraction({
			options: {
				getFocused: vi.fn((withName?: boolean) =>
					withName ? { name: 'server', value: '' } : '',
				),
			},
		});

		await command.autocomplete?.(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'blue server', value: 'BLUE' },
			{ name: 'green server', value: 'GREEN' },
		]);
	});

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

	it('rejects a stale selection for a disabled server', async () => {
		delete process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		resetConfigCache();
		vi.mocked(addPlayerBlock).mockClear();
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					player: { value: 'SOANDSO' },
					server: { value: Server.RED },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(addPlayerBlock).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content: expect.stringContaining('not currently monitored'),
			flags: MessageFlags.Ephemeral,
		});
	});
});
