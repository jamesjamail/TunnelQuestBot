import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	removePlayerLink: vi.fn(),
}));

import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server } from '../../../prisma/client';
import command from './unlink';
import { removePlayerLink } from '../../../prisma/dbExecutors/playerLink';
import { messageCopy } from '../../content/copy/messageCopy';
import {
	makeAutocompleteInteraction,
	makeChatInteraction,
} from '../../../test/factories';
import { resetConfigCache } from '../../../config';

const redClassic = process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
const redEmbedded = process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;

describe('unlink command', () => {
	beforeEach(() => {
		vi.mocked(removePlayerLink).mockReset();
	});

	afterEach(() => {
		process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID = redClassic;
		process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID = redEmbedded;
		resetConfigCache();
	});

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

	it('rejects a stale selection for a disabled server', async () => {
		delete process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		resetConfigCache();
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					player: { value: 'Soandso' },
					server: { value: Server.RED },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(removePlayerLink).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content: expect.stringContaining('not currently monitored'),
			flags: MessageFlags.Ephemeral,
		});
	});
});
