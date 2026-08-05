import { vi } from 'vitest';
vi.mock('../../../prisma/dbExecutors/block', () => ({
	getPlayerBlocks: vi.fn(async () => []),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { autocompleteBlocks } from './autocompleteBlocks';
import { getPlayerBlocks } from '../../../prisma/dbExecutors/block';
import {
	makeAutocompleteInteraction,
	makeBlockedPlayer,
} from '../../../test/factories';

describe('autocompleteBlocks', () => {
	beforeEach(() => {
		vi.mocked(getPlayerBlocks).mockReset();
	});

	it('caps results at 25 using index comparison', async () => {
		const blocks = Array.from({ length: 40 }, (_, i) =>
			makeBlockedPlayer({ id: i + 1, player: `PLAYER ${i + 1}` }),
		);
		vi.mocked(getPlayerBlocks).mockResolvedValue(blocks);

		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => 'PLAYER' },
		});

		await autocompleteBlocks(interaction);

		expect(getPlayerBlocks).toHaveBeenCalledWith('100');
		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toHaveLength(25);
	});

	it('responds with an empty list when there are no blocks', async () => {
		vi.mocked(getPlayerBlocks).mockResolvedValue([]);

		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => '' },
		});

		await autocompleteBlocks(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([]);
	});
});
