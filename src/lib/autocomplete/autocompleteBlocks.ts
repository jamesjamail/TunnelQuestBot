import { AutocompleteInteraction, CacheType } from 'discord.js';
import { getPlayerBlocks } from '../../prisma/dbExecutors';
import { parseBlockedPlayersForAutoSuggest } from '../helpers/helpers';

export async function autocompleteBlocks(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focusedValue = interaction.options.getFocused();
	const blocks = await getPlayerBlocks(interaction.user.id);
	const blockNames = parseBlockedPlayersForAutoSuggest(blocks);
	const filtered = blockNames.filter(
		(choice, index) => choice.name.startsWith(focusedValue) && index < 25,
	);
	await interaction.respond(filtered);
}
