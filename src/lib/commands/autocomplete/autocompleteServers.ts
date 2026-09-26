import type { AutocompleteInteraction, CacheType } from 'discord.js';
import { enabledServers } from '../../../config';
import { respondToAutocomplete } from './autocompleteHelpers';

export async function autocompleteServers(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focused = interaction.options.getFocused().toLowerCase();
	const choices = enabledServers()
		.filter((server) => server.toLowerCase().includes(focused))
		.map((server) => ({
			name: `${server.toLowerCase()} server`,
			value: server,
		}));

	await respondToAutocomplete(interaction, choices);
}
