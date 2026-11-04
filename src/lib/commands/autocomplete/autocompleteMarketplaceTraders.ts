import type { AutocompleteInteraction, CacheType } from 'discord.js';
import { getHiddenTraders } from '../../../prisma/dbExecutors/block';
import { getMarketplaceViewsForUser } from '../../../prisma/dbExecutors/marketplace';
import { respondToAutocomplete } from './autocompleteHelpers';

const MAX_CHOICES = 25;

// 	`hide` offers the traders currently matched with the user; `unhide` offers
// 	the ones they have hidden. The value is the discord user id either way.
export async function autocompleteMarketplaceTraders(
	interaction: AutocompleteInteraction<CacheType>,
) {
	const focused = interaction.options.getFocused(true);
	const typed = focused.value.toLowerCase();

	let traders: { id: string; name: string }[];
	if (focused.name === 'unhide') {
		const hidden = await getHiddenTraders(interaction.user.id);
		traders = hidden.map((h) => ({
			id: h.hiddenDiscordUserId,
			name: h.discordUsername ?? h.hiddenDiscordUserId,
		}));
	} else {
		const views = await getMarketplaceViewsForUser(interaction.user.id);
		const byId = new Map<string, string>();
		for (const view of views) {
			for (const { watch } of view.counterparts) {
				byId.set(watch.discordUserId, watch.user.discordUsername);
			}
		}
		traders = [...byId].map(([id, name]) => ({ id, name }));
	}

	const choices = traders
		.filter((trader) => trader.name.toLowerCase().includes(typed))
		.slice(0, MAX_CHOICES)
		.map((trader) => ({
			name: trader.name.slice(0, 100),
			value: trader.id,
		}));
	await respondToAutocomplete(interaction, choices);
}
