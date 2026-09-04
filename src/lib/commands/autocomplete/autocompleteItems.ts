import { AutocompleteInteraction, CacheType } from 'discord.js';
import Fuse from 'fuse.js';
import { toTitleCase } from '../../helpers/titleCase';
import {
	consolidatedItems,
	resolveCanonicalItemName,
} from '../../gameData/consolidatedItems';
import inGameAliasesRaw from '../../gameData/aliases.json';
import { respondToAutocomplete } from './autocompleteHelpers';

type AutocompleteEntry = {
	value: string;
	displayName?: string;
	searchText: string;
};

function buildAutocompleteIndex(): AutocompleteEntry[] {
	const canonicalEntries = Object.keys(consolidatedItems).map((key) => ({
		value: key,
		searchText: key,
	}));

	const aliasEntries = Object.keys(inGameAliasesRaw)
		.filter((alias) => !consolidatedItems[alias])
		.map((alias) => {
			const canonicalName = resolveCanonicalItemName(alias);
			return {
				value: alias,
				displayName: `${alias} (${toTitleCase(canonicalName)})`,
				searchText: `${alias} ${canonicalName}`,
			};
		});

	return [...canonicalEntries, ...aliasEntries];
}

// Configure Fuse.js options
const options = {
	keys: ['searchText'],
	includeScore: true,
	threshold: 0.3, // Adjust as needed. Lower values make the search stricter.
};

// 	the item list is static, so the index is built once at startup rather than on
// 	every keystroke - rebuilding it per request risks blowing Discord's 3s budget
const fuse = new Fuse(buildAutocompleteIndex(), options);

export async function autocompleteItems(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused();

	if (focusedValue.length === 0) {
		return await respondToAutocomplete(interaction, [
			{
				name: 'start typing an item name for suggestions',
				value: '',
			},
		]);
	}

	// Perform the fuzzy search
	const results = fuse.search(focusedValue);

	// Extract the top 25 results and map them to the desired format
	const topResults = results.slice(0, 25).map((result) => {
		return {
			name: result.item.displayName ?? toTitleCase(result.item.value),
			value: result.item.value,
		};
	});

	await respondToAutocomplete(interaction, topResults);
}
