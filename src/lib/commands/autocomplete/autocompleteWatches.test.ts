import { vi } from 'vitest';
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchesByDiscordUser: vi.fn(async () => []),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import {
	autocompleteWatches,
	autocompleteWatchesWithAllWatchesOption,
} from './autocompleteWatches';
import { getWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import { makeChatInteraction, makeWatch } from '../../../test/factories';
import type { AutocompleteInteraction } from 'discord.js';

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

	it('does not match suffix-only focused values', async () => {
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue([
			makeWatch({ id: 1, itemName: 'ZZZ SWORD' }),
		]);

		const interaction = makeChatInteraction({
			options: { getFocused: () => 'sword' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatches(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([]);
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

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toHaveLength(25);
	});

	it('responds with an empty list when the user has no watches', async () => {
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue([]);

		const interaction = makeChatInteraction({
			options: { getFocused: () => '' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatches(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([]);
	});
});

describe('autocompleteWatchesWithAllWatchesOption', () => {
	beforeEach(() => {
		vi.mocked(getWatchesByDiscordUser).mockReset();
	});

	it('includes All Watches even when the user has no watches', async () => {
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue([]);

		const interaction = makeChatInteraction({
			options: { getFocused: () => '' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatchesWithAllWatchesOption(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'All Watches', value: 'ALL WATCHES' },
		]);
	});

	it('filters All Watches by prefix like other choices', async () => {
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue([]);

		const interaction = makeChatInteraction({
			options: { getFocused: () => 'all' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatchesWithAllWatchesOption(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'All Watches', value: 'ALL WATCHES' },
		]);
	});

	it('caps combined results at 25 entries', async () => {
		const watches = Array.from({ length: 40 }, (_, i) =>
			makeWatch({
				id: i + 1,
				itemName: `ITEM ${String(i + 1).padStart(2, '0')}`,
			}),
		);
		vi.mocked(getWatchesByDiscordUser).mockResolvedValue(watches);

		const interaction = makeChatInteraction({
			options: { getFocused: () => 'ITEM' },
		}) as unknown as AutocompleteInteraction;

		await autocompleteWatchesWithAllWatchesOption(interaction);

		const choices = vi.mocked(interaction.respond).mock.calls[0][0];
		expect(choices).toHaveLength(25);
	});
});
