import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	upsertWatchSafely: vi.fn(),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { afterEach, describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server, WatchType } from '../../../prisma/client';
import command from './watch';
import { upsertWatchSafely } from '../../../prisma/dbExecutors/watch';
import { gracefullyHandleError } from '../../helpers/errors';
import {
	makeAutocompleteInteraction,
	makeChatInteraction,
	makeWatch,
} from '../../../test/factories';
import { resetConfigCache } from '../../../config';

const redClassic = process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
const redEmbedded = process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;

afterEach(() => {
	process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID = redClassic;
	process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID = redEmbedded;
	resetConfigCache();
});

function mockWatchOptions(
	interaction: ReturnType<typeof makeChatInteraction>,
	overrides: Record<string, unknown> = {},
) {
	const values: Record<string, { value: unknown }> = {
		server: { value: Server.BLUE },
		item: { value: 'FLOWING BLACK SILK SASH' },
		type: { value: WatchType.WTS },
		...overrides,
	};
	vi.mocked(interaction.options.get).mockImplementation(
		(name: string) => values[name] ?? null,
	);
}

describe('watch command', () => {
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

	it('upserts and replies with an embed and three inactive buttons', async () => {
		const watch = makeWatch({ id: 12 });
		vi.mocked(upsertWatchSafely).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		expect(upsertWatchSafely).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({
				server: Server.BLUE,
				itemName: 'FLOWING BLACK SILK SASH',
				watchType: WatchType.WTS,
			}),
		);
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.embeds).toHaveLength(1);
		expect(reply?.components?.[0]?.components).toHaveLength(3);
		expect(reply?.flags).toBe(MessageFlags.Ephemeral);
	});

	it('replies with instructional copy when item is empty', async () => {
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction, { item: { value: '' } });

		await command.execute(interaction);

		expect(upsertWatchSafely).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.stringContaining("You didn't enter an item name"),
		);
		expect(gracefullyHandleError).not.toHaveBeenCalled();
	});

	it('allows optional price and notes to be absent', async () => {
		vi.mocked(upsertWatchSafely).mockResolvedValue(makeWatch());
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		expect(upsertWatchSafely).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({
				priceRequirement: undefined,
				notes: undefined,
			}),
		);
	});

	it('rejects a stale selection for a disabled server', async () => {
		delete process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		resetConfigCache();
		vi.mocked(upsertWatchSafely).mockClear();
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction, { server: { value: Server.RED } });

		await command.execute(interaction);

		expect(upsertWatchSafely).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content: expect.stringContaining('not currently monitored'),
			flags: MessageFlags.Ephemeral,
		});
	});
});
