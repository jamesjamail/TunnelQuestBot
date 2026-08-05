import { AutocompleteInteraction, CacheType } from 'discord.js';
import Fuse from 'fuse.js';
import { toTitleCase } from '../../helpers/titleCase';
import { consolidatedItems } from '../../gameData/consolidatedItems';
import { respondToAutocomplete } from './autocompleteHelpers';

// Convert the JSON object keys to an array of item names
const itemNames = Object.keys(consolidatedItems).map((key) => {
	return { name: key };
});

// Configure Fuse.js options
const options = {
	keys: ['name'],
	includeScore: true,
	threshold: 0.3, // Adjust as needed. Lower values make the search stricter.
};

// 	the item list is static, so the index is built once at startup rather than on
// 	every keystroke - rebuilding it per request risks blowing Discord's 3s budget
const fuse = new Fuse(itemNames, options);

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
			name: toTitleCase(result.item.name),
			value: result.item.name,
		};
	});

	await respondToAutocomplete(interaction, topResults);
}
