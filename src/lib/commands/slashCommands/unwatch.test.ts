import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	unwatch: vi.fn(),
	unwatchAllWatches: vi.fn(),
	unwatchByWatchName: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './unwatch';
import {
	unwatch,
	unwatchAllWatches,
	unwatchByWatchName,
} from '../../../prisma/dbExecutors/watch';
import { prefixJSON } from '../autocomplete/autocompleteHelpers';
import { messageCopy } from '../../content/copy/messageCopy';
import { makeChatInteraction, makeWatch } from '../../../test/factories';

describe('unwatch command', () => {
	it('unwatches by id for auto-suggestion selections', async () => {
		const watch = makeWatch({ id: 3, itemName: 'SWORD' });
		vi.mocked(unwatch).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch'
				? {
						value: prefixJSON(JSON.stringify({ watch: { id: 3 } })),
					}
				: null,
		);

		await command.execute(interaction);

		expect(unwatch).toHaveBeenCalled();
		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.embeds).toHaveLength(1);
		expect(reply?.components).toHaveLength(1);
		expect(reply?.flags).toBe(MessageFlags.Ephemeral);
	});

	it('unwatches all watches for ALL WATCHES case-insensitively without embeds', async () => {
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: 'all watches' } : null,
		);

		await command.execute(interaction);

		expect(unwatchAllWatches).toHaveBeenCalledWith(interaction);
		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.allYourWatchesHaveBeenUnwatched,
			flags: MessageFlags.Ephemeral,
		});
	});

	it('unwatches by raw watch name otherwise', async () => {
		const watch = makeWatch({ itemName: 'SWORD' });
		vi.mocked(unwatchByWatchName).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: 'SWORD' } : null,
		);

		await command.execute(interaction);

		expect(unwatchByWatchName).toHaveBeenCalledWith(interaction, 'SWORD');
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: messageCopy.yourWatchHasBeenUnwatched(
					watch.itemName,
					watch.server,
				),
			}),
		);
	});
});
