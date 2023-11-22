import { AutocompleteInteraction, CacheType } from 'discord.js';
import { getSnoozedWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import { parseWatchesForAutocomplete } from './autocompleteHelpers';

// TODO: handle for situations where users don't have any watches - or test if that is a problem
export async function autocompleteSnoozedWatches(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused().toUpperCase();
	const watches = await getSnoozedWatchesByDiscordUser(interaction.user);
	// 	add "all watches" as an autocomplete suggestion
	const watchNames = [
		{ name: 'All Watches', value: 'ALL WATCHES' },
		...parseWatchesForAutocomplete(watches),
	];
	const filtered = watchNames.filter(
		(choice, index) =>
			choice.name.toUpperCase().startsWith(focusedValue) && index < 25,
	);

	await interaction.respond(filtered);
}
