import { vi } from 'vitest';
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getSnoozedWatchesByDiscordUser: vi.fn(async () => []),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { autocompleteSnoozedWatches } from './autocompleteSnoozedWatches';
import { getSnoozedWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import {
	makeAutocompleteInteraction,
	makeWatch,
} from '../../../test/factories';

describe('autocompleteSnoozedWatches', () => {
	beforeEach(() => {
		vi.mocked(getSnoozedWatchesByDiscordUser).mockReset();
	});

	it('includes All Watches and caps results at 25', async () => {
		const watches = Array.from({ length: 40 }, (_, i) =>
			makeWatch({
				id: i + 1,
				itemName: `ITEM ${String(i + 1).padStart(2, '0')}`,
				snoozedUntil: new Date(Date.now() + 3600000),
			}),
		);
		vi.mocked(getSnoozedWatchesByDiscordUser).mockResolvedValue(watches);

		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => '' },
		});

		await autocompleteSnoozedWatches(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices[0]).toEqual({
			name: 'All Watches',
			value: 'ALL WATCHES',
		});
		expect(choices).toHaveLength(25);
	});

	it('responds with only All Watches when there are no snoozed watches', async () => {
		vi.mocked(getSnoozedWatchesByDiscordUser).mockResolvedValue([]);

		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => '' },
		});

		await autocompleteSnoozedWatches(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'All Watches', value: 'ALL WATCHES' },
		]);
	});
});
