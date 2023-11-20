import { AutocompleteInteraction, CacheType } from 'discord.js';
import { getWatchesByDiscordUser } from '../../../prisma/dbExecutors/watch';
import { parseWatchesForAutocomplete } from './autocompleteHelpers';

// TODO: handle for situations where users don't have any watches - or test if that is a problem
export async function autocompleteWatches(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused();
	const watches = await getWatchesByDiscordUser(interaction.user);
	const watchNames = [
		{ name: 'All Watches', value: 'ALL WATCHES' },
		...parseWatchesForAutocomplete(watches),
	];
	const filtered = watchNames.filter(
		(choice, index) => choice.name.startsWith(focusedValue) && index < 25,
	);
	await interaction.respond(filtered);
}
