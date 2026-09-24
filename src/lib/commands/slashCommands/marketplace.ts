import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import {
	marketplaceCommandResponseBuilder,
	packEmbedsForDiscord,
} from '../../content/messages/messageBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import {
	getHiddenTraders,
	hideTrader,
	unhideTrader,
} from '../../../prisma/dbExecutors/block';
import { getMarketplaceViewsForUser } from '../../../prisma/dbExecutors/marketplace';
import { hideTraderOptions, unhideTraderOptions } from '../commandOptions';
import { autocompleteMarketplaceTraders } from '../autocomplete/autocompleteMarketplaceTraders';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

// 	autocomplete supplies a discord user id; anything else was typed by hand
const DISCORD_USER_ID = /^\d{17,20}$/;

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('marketplace')
		.setDescription('see the traders matching your watches')
		.addStringOption(hideTraderOptions)
		.addStringOption(unhideTraderOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteMarketplaceTraders(interaction);
	},
	execute: async (interaction) => {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const args = getInteractionArgs(
				interaction,
				[],
				['hide', 'unhide'],
			);
			const toHide = args?.hide?.value as string | undefined;
			const toUnhide = args?.unhide?.value as string | undefined;

			if (toHide && toUnhide) {
				return await interaction.editReply(
					messageCopy.hideOrUnhideNotBoth,
				);
			}

			const user = await findOrCreateUser(interaction.user);

			if (toHide || toUnhide) {
				const traderId = (toHide ?? toUnhide) as string;
				if (!DISCORD_USER_ID.test(traderId)) {
					return await interaction.editReply(
						messageCopy.pickATraderFromTheSuggestions,
					);
				}

				if (toHide) {
					if (traderId === user.discordUserId) {
						return await interaction.editReply(
							messageCopy.youCantHideYourself,
						);
					}
					await hideTrader(user.discordUserId, traderId);
					return await interaction.editReply(
						messageCopy.traderHasBeenHidden(traderId),
					);
				}

				const removed = await unhideTrader(
					user.discordUserId,
					traderId,
				);
				return await interaction.editReply(
					removed
						? messageCopy.traderHasBeenUnhidden(traderId)
						: messageCopy.traderWasNotHidden(traderId),
				);
			}

			const [views, hidden] = await Promise.all([
				getMarketplaceViewsForUser(user.discordUserId),
				getHiddenTraders(user.discordUserId),
			]);

			if (views.length === 0) {
				return await interaction.editReply(
					messageCopy.youDontHaveAnyWatches,
				);
			}

			const embeds = marketplaceCommandResponseBuilder(
				views,
				user,
				hidden.map((h) => h.hiddenDiscordUserId),
			);
			const [first, ...rest] = packEmbedsForDiscord(embeds);
			await interaction.editReply({ embeds: first });
			for (const batch of rest) {
				await interaction.followUp({
					embeds: batch,
					flags: MessageFlags.Ephemeral,
				});
			}
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
