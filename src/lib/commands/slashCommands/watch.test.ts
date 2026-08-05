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

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import { Server, WatchType } from '@prisma/client';
import command from './watch';
import { upsertWatchSafely } from '../../../prisma/dbExecutors/watch';
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
});
