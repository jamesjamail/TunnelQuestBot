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

	it('suggests aliases such as FBSS with the canonical name in the label', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => 'fbss' },
		});

		await autocompleteItems(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					value: 'FBSS',
					name: expect.stringContaining('Flowing Black Silk Sash'),
				}),
			]),
		);
	});

	it('still suggests canonical item names for partial matches', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => 'flowing black silk' },
		});

		await autocompleteItems(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					value: 'FLOWING BLACK SILK SASH',
				}),
			]),
		);
	});

	it('skips alias entries when the alias is already a canonical item name', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: () => "executioner's axe" },
		});

		await autocompleteItems(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		const values = choices.map((choice) => choice.value);
		expect(new Set(values).size).toBe(values.length);
		expect(values).toEqual(expect.arrayContaining(["EXECUTIONER'S AXE"]));
	});
});
