import { AutocompleteInteraction, CacheType } from 'discord.js';
import { getPlayerBlocks } from '../../../prisma/dbExecutors/block';
import { parseBlockedPlayersForAutocomplete } from './autocompleteHelpers';

export async function autocompleteBlocks(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused().toUpperCase();
	const blocks = await getPlayerBlocks(interaction.user.id);
	const blockNames = parseBlockedPlayersForAutocomplete(blocks);
	const filtered = blockNames.filter(
		(choice, index) =>
			choice.name.toUpperCase().startsWith(focusedValue) && index < 25,
	);
	await interaction.respond(filtered);
}
