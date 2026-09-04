import { AutocompleteInteraction, CacheType } from 'discord.js';
import { getWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import {
	parseWatchesForAutocomplete,
	respondToAutocomplete,
} from './autocompleteHelpers';

// TODO: handle for situations where users don't have any watches - or test if that is a problem
export async function autocompleteWatchesWithAllWatchesOption(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused().toUpperCase();
	const watches = await getWatchesByDiscordUser(interaction.user);
	const watchNames = [
		{ name: 'All Watches', value: 'ALL WATCHES' },
		...parseWatchesForAutocomplete(watches),
	];
	const filtered = watchNames
		.filter((choice) => choice.name.toUpperCase().startsWith(focusedValue))
		.slice(0, 25);
	await respondToAutocomplete(interaction, filtered);
}

// TODO: handle for situations where users don't have any watches - or test if that is a problem
export async function autocompleteWatches(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused().toUpperCase();
	const watches = await getWatchesByDiscordUser(interaction.user);
	const watchNames = parseWatchesForAutocomplete(watches);
	const filtered = watchNames
		.filter((choice) => choice.name.toUpperCase().startsWith(focusedValue))
		.slice(0, 25);
	await respondToAutocomplete(interaction, filtered);
}
