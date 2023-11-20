import { AutocompleteInteraction, CacheType } from 'discord.js';
import Fuse from 'fuse.js';
import { toTitleCase } from '../../helpers/titleCase';
import itemsData from '../../gameData/items.json';

export async function autocompleteItems(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused();

	if (focusedValue.length === 0) {
		return await interaction.respond([
			{
				name: 'start typing an item name for suggestions',
				value: '',
			},
		]);
	}

	// Convert the JSON object keys to an array of item names
	const itemNames = Object.keys(itemsData).map((key) => {
		return { name: key };
	});

	// Configure Fuse.js options
	const options = {
		keys: ['name'],
		includeScore: true,
		threshold: 0.3, // Adjust as needed. Lower values make the search stricter.
	};

	const fuse = new Fuse(itemNames, options);

	// Perform the fuzzy search
	const results = fuse.search(focusedValue);

	// Extract the top 25 results and map them to the desired format
	const topResults = results.slice(0, 25).map((result) => {
		return {
			name: toTitleCase(result.item.name),
			value: result.item.name,
		};
	});

	await interaction.respond(topResults);
}
