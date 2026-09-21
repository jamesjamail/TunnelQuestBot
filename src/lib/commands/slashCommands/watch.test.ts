import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	upsertWatchSafely: vi.fn(),
}));
vi.mock('../../marketplace/marketplaceMatching', () => ({
	checkForMarketplaceMatches: vi.fn(async () => undefined),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { Server, WatchType } from '../../../prisma/client';
import command from './watch';
import { upsertWatchSafely } from '../../../prisma/dbExecutors/watch';
import { checkForMarketplaceMatches } from '../../marketplace/marketplaceMatching';
import { gracefullyHandleError } from '../../helpers/errors';
import { makeChatInteraction, makeWatch } from '../../../test/factories';

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
		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
		const reply = vi.mocked(interaction.editReply).mock.calls[0][0];
		expect(reply).toMatchObject({ embeds: [expect.anything()] });
		expect(
			(reply as { components: { components: unknown[] }[] }).components[0]
				.components,
		).toHaveLength(3);
	});

	it('defers before doing any marketplace work so the ack window is not at risk', async () => {
		vi.mocked(upsertWatchSafely).mockResolvedValue(makeWatch());
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		expect(
			vi.mocked(interaction.deferReply).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(checkForMarketplaceMatches).mock.invocationCallOrder[0],
		);
	});

	it('checks for marketplace matches after a successful upsert', async () => {
		const watch = makeWatch({ id: 12 });
		vi.mocked(upsertWatchSafely).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		expect(checkForMarketplaceMatches).toHaveBeenCalledWith(watch);
	});

	it('adds the marketplace matches to the reply as a second embed', async () => {
		const marketplaceEmbed = new EmbedBuilder().setTitle('Marketplace');
		vi.mocked(upsertWatchSafely).mockResolvedValue(makeWatch({ id: 12 }));
		vi.mocked(checkForMarketplaceMatches).mockResolvedValueOnce(
			marketplaceEmbed,
		);
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as {
			embeds: EmbedBuilder[];
		};
		expect(reply.embeds).toHaveLength(2);
		expect(reply.embeds[1]).toBe(marketplaceEmbed);
	});

	it('still confirms the watch, and reports the error, when matching fails', async () => {
		const error = new Error('db down');
		vi.mocked(upsertWatchSafely).mockResolvedValue(makeWatch({ id: 12 }));
		vi.mocked(checkForMarketplaceMatches).mockRejectedValueOnce(error);
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction);

		await command.execute(interaction);

		expect(gracefullyHandleError).toHaveBeenCalledWith(
			error,
			interaction,
			command,
			{ watchId: 12, phase: 'marketplaceMatching' },
		);
		const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as {
			embeds: EmbedBuilder[];
		};
		expect(reply.embeds).toHaveLength(1);
	});

	it('forwards the marketplace opt-in flag to upsertWatchSafely', async () => {
		vi.mocked(upsertWatchSafely).mockResolvedValue(makeWatch());
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction, { marketplace: { value: true } });

		await command.execute(interaction);

		expect(upsertWatchSafely).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({ isPublicallyTradeable: true }),
		);
	});

	it('does not check for marketplace matches when the item name is missing', async () => {
		const interaction = makeChatInteraction();
		mockWatchOptions(interaction, { item: { value: '' } });

		await command.execute(interaction);

		expect(checkForMarketplaceMatches).not.toHaveBeenCalled();
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
});
