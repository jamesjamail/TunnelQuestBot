import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import type { Server, WatchType } from '../../../prisma/client';
import {
	requiredsServerOptions,
	watchTypeOptions,
	priceCriteriaOptions,
	autoCompleteItemNameOptions,
	watchNotesOptions,
	marketplaceOptions,
} from '../commandOptions';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { autocompleteItems } from '../autocomplete/autocompleteItems';
import { upsertWatchSafely } from '../../../prisma/dbExecutors/watch';
import {
	buildMarketplacePreview,
	commitMarketplacePreview,
	type MarketplacePreview,
} from '../../marketplace/marketplaceMatching';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';
import { isSnoozed } from '../../helpers/watches';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('add or modify a watch.')
		.addStringOption(watchTypeOptions)
		.addStringOption(autoCompleteItemNameOptions)
		.addStringOption(requiredsServerOptions)
		.addNumberOption(priceCriteriaOptions)
		.addStringOption(watchNotesOptions)
		.addBooleanOption(marketplaceOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteItems(interaction);
	},
	execute: async (interaction) => {
		try {
			const args = getInteractionArgs(
				interaction,
				['server', 'item', 'type'],
				['price', 'notes', 'marketplace'],
			);

			if (!args.item.value) {
				return await interaction.reply(
					`You didn't enter an item name. Instead of selecting the option \`start typing an item name for suggestions\`, either select a suggested option or enter your own.`,
				);
			}

			// 	matching does a DB write per new pair, which can outlast Discord's
			// 	3s ack window on a popular item
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const data = await upsertWatchSafely(interaction, {
				server: args.server.value as Server,
				itemName: args.item.value as string,
				watchType: args.type.value as WatchType,
				priceRequirement: args?.price?.value as number,
				notes: args?.notes?.value as string,
				isPublicallyTradeable: args?.marketplace?.value as boolean,
			});

			// 	a failure here must not lose the confirmation for a watch that saved
			let preview: MarketplacePreview | undefined;
			try {
				preview = await buildMarketplacePreview(data);
			} catch (error) {
				await gracefullyHandleError(error, interaction, command, {
					watchId: data.id,
					phase: 'marketplaceMatching',
				});
			}

			const embeds = [watchCommandResponseBuilder(data)];
			// 	the marketplace embed's own footer is what states the watch's
			// 	listing status, so it is shown even with no matches yet - and its
			// 	button row is what carries the advertised 🤝 listing toggle
			let components: ReturnType<typeof buttonRowBuilder>;
			if (preview) {
				embeds.push(preview.embed);
				components = buttonRowBuilder(
					MessageTypes.marketplace,
					[
						isSnoozed(data.snoozedUntil),
						!data.active,
						false,
						data.isPublicallyTradeable,
					],
					String(data.id),
				);
			} else {
				components = buttonRowBuilder(
					MessageTypes.watch,
					[false, false, false],
					String(data.id),
				);
			}

			const reply = await interaction.editReply({ embeds, components });

			// 	only commit the claim once Discord confirms the preview was
			// 	actually delivered - see commitMarketplacePreview
			if (preview) {
				await commitMarketplacePreview(preview).catch((error) =>
					gracefullyHandleError(error, interaction, command, {
						watchId: data.id,
						phase: 'marketplaceClaimCommit',
					}),
				);
			}

			return reply;
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 3,
};

export default command;
