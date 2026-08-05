import { vi } from 'vitest';
import { describe, it, expect } from 'vitest';
import { autocompleteItems } from './autocompleteItems';
import { makeAutocompleteInteraction } from '../../../test/factories';

describe('autocompleteItems', () => {
	it('returns a placeholder choice for an empty focused value', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => '' },
		});

		await autocompleteItems(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{
				name: 'start typing an item name for suggestions',
				value: '',
			},
		]);
	});

	it('returns fuzzy matches capped at 25 for a non-empty focused value', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => 'silk' },
		});

		await autocompleteItems(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices.length).toBeGreaterThan(0);
		expect(choices.length).toBeLessThanOrEqual(25);
	});

	it('returns an empty list for a nonsense focused value', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => 'zzzznotarealitemname99999' },
		});

		await autocompleteItems(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([]);
	});
});
