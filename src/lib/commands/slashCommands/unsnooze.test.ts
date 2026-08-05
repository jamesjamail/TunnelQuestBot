import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	unsnoozeWatch: vi.fn(),
	unsnoozeWatchByItemName: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './unsnooze';
import {
	unsnoozeWatch,
	unsnoozeWatchByItemName,
} from '../../../prisma/dbExecutors/watch';
import { prefixJSON } from '../autocomplete/autocompleteHelpers';
import { messageCopy } from '../../content/copy/messageCopy';
import { makeChatInteraction, makeWatch } from '../../../test/factories';

describe('unsnooze command', () => {
	it('unsnoozes by id for auto-suggestion selections with unsnooze copy', async () => {
		const watch = makeWatch({ id: 6 });
		vi.mocked(unsnoozeWatch).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch'
				? {
						value: prefixJSON(JSON.stringify({ watch: { id: 6 } })),
					}
				: null,
		);

		await command.execute(interaction);

		expect(unsnoozeWatch).toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: messageCopy.yourWatchHasBeenUnsnoozed,
				flags: MessageFlags.Ephemeral,
			}),
		);
	});

	it('unsnoozes by raw item name otherwise', async () => {
		const watch = makeWatch({ itemName: 'SWORD' });
		vi.mocked(unsnoozeWatchByItemName).mockResolvedValue(watch);
		const interaction = makeChatInteraction();
		vi.mocked(interaction.options.get).mockImplementation((name: string) =>
			name === 'watch' ? { value: 'SWORD' } : null,
		);

		await command.execute(interaction);

		expect(unsnoozeWatchByItemName).toHaveBeenCalledWith(
			interaction,
			'SWORD',
		);
		expect(interaction.reply).toHaveBeenCalledWith(
			expect.objectContaining({
				content: messageCopy.yourWatchHasBeenUnsnoozed,
			}),
		);
	});
});
