import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchByWatchId: vi.fn(),
	getWatchByItemName: vi.fn(),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './getWatch';
import {
	getWatchByWatchId,
	getWatchByItemName,
} from '../../../prisma/dbExecutors/watch';
import { prefixJSON } from '../autocomplete/autocompleteHelpers';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';
import { makeChatInteraction, makeWatch } from '../../../test/factories';

describe('getWatch command', () => {
	it('looks up by watch id for auto-suggestion selections', async () => {
		const watch = makeWatch({ id: 4, itemName: 'SWORD' });
		vi.mocked(getWatchByWatchId).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch'
				? {
						value: prefixJSON(JSON.stringify({ watch: { id: 4 } })),
					}
				: null,
		);

		await command.execute(interaction);

		expect(getWatchByWatchId).toHaveBeenCalledWith(4);
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.content).toBe(
			messageCopy.heresInformationOnYourWatch(watch.itemName),
		);
		expect(reply?.embeds).toHaveLength(1);
		expect(reply?.components).toHaveLength(1);
		expect(reply?.flags).toBe(MessageFlags.Ephemeral);
	});

	it('looks up by raw item name when not auto-suggested', async () => {
		const watch = makeWatch({ itemName: 'SWORD' });
		vi.mocked(getWatchByItemName).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: 'SWORD' } : null,
		);

		await command.execute(interaction);

		expect(getWatchByItemName).toHaveBeenCalledWith('100', 'SWORD');
	});

	it('replies with not-found copy when lookup throws', async () => {
		vi.mocked(getWatchByItemName).mockRejectedValue(new Error('missing'));
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: 'MISSING' } : null,
		);

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.iCouldntFindAnyWatchesForItemName('MISSING'),
			flags: MessageFlags.Ephemeral,
		});
	});

	it('replies once with instructional copy when watch value is empty', async () => {
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: '' } : null,
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
