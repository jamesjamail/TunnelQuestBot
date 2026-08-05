import { vi } from 'vitest';
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchesByDiscordUser: vi.fn(async () => []),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { autocompleteWatches } from './autocompleteWatches';
import { getWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import { makeChatInteraction, makeWatch } from '../../../test/factories';
import { AutocompleteInteraction } from 'discord.js';

describe('autocompleteWatches', () => {
	beforeEach(() => {
		vi.mocked(getWatchesByDiscordUser).mockReset();
	});

	it('returns a matching watch even when it appears after index 25 in the list', async () => {
		const watches = Array.from({ length: 30 }, (_, i) =>
			makeWatch({
				id: i + 1,
				itemName: `ITEM ${String(i + 1).padStart(2, '0')}`,
			}),
		);
		watches[27] = makeWatch({ id: 28, itemName: 'ZZZ SWORD' });
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue(watches);

		const interaction = makeChatInteraction({
			options: { getFocused: () => 'ZZZ' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatches(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			expect.objectContaining({ name: 'Zzz Sword' }),
		]);
	});

	it('caps autocomplete results at 25 choices', async () => {
		const watches = Array.from({ length: 30 }, (_, i) =>
			makeWatch({
				id: i + 1,
				itemName: `ITEM ${String(i + 1).padStart(2, '0')}`,
			}),
		);
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue(watches);

		const interaction = makeChatInteraction({
			options: { getFocused: () => 'ITEM' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatches(interaction);

		expect(interaction.respond).toHaveBeenCalledWith(
			expect.arrayContaining([expect.any(Object)]),
		);
		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toHaveLength(25);
	});
});
