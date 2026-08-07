import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/user', () => ({
	findOrCreateUser: vi.fn(),
}));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	snoozeAllWatches: vi.fn(),
	snoozeWatch: vi.fn(),
	snoozeWatchByItemName: vi.fn(),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './snooze';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import {
	snoozeAllWatches,
	snoozeWatch,
	snoozeWatchByItemName,
} from '../../../prisma/dbExecutors/watch';
import { prefixJSON } from '../autocomplete/autocompleteHelpers';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';
import {
	makeChatInteraction,
	makeUser,
	makeWatch,
} from '../../../test/factories';

describe('snooze command', () => {
	it('snoozes all watches for ALL WATCHES and renders the list embed', async () => {
		const watches = [makeWatch(), makeWatch({ id: 2 })];
		vi.mocked(snoozeAllWatches).mockResolvedValue(watches);
		vi.mocked(findOrCreateUser).mockResolvedValue(makeUser());
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					watch: { value: 'ALL WATCHES' },
					hours: { value: 6 },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(snoozeAllWatches).toHaveBeenCalledWith('100');
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.content).toBe(
			messageCopy.allYourWatchesHaveBeenSnoozed(6),
		);
		expect(reply?.embeds?.length).toBeGreaterThan(0);
		expect(reply?.components).toHaveLength(1);
	});

	it('snoozes a specific watch for auto-suggestion selections', async () => {
		const watch = makeWatch({ id: 8 });
		vi.mocked(snoozeWatch).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					watch: {
						value: prefixJSON(JSON.stringify({ watch: { id: 8 } })),
					},
					hours: { value: 3 },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(snoozeWatch).toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: messageCopy.yourWatchHasBeenSnoozed(3),
			}),
		);
	});

	it('snoozes by raw item name when not auto-suggested', async () => {
		const watch = makeWatch({ itemName: 'SWORD' });
		vi.mocked(snoozeWatchByItemName).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					watch: { value: 'SWORD' },
					hours: { value: 2 },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(snoozeWatchByItemName).toHaveBeenCalledWith(
			interaction,
			'SWORD',
		);
	});

	it('replies with not-found copy when lookup throws', async () => {
		vi.mocked(snoozeWatchByItemName).mockRejectedValue(
			new Error('missing'),
		);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					watch: { value: 'MISSING' },
					hours: { value: 2 },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.iCouldntFindAnyWatchesForItemName('MISSING'),
			flags: MessageFlags.Ephemeral,
		});
	});

	it('replies once with instructional copy when watch value is empty', async () => {
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation(
			(name: string) =>
				({
					watch: { value: '' },
					hours: { value: 2 },
				})[name] ?? null,
		);

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledTimes(1);
		expect(interaction.reply).toHaveBeenCalledWith({
			content: expect.stringContaining("You didn't enter an item name"),
			flags: MessageFlags.Ephemeral,
		});
		expect(gracefullyHandleError).not.toHaveBeenCalled();
	});
});
