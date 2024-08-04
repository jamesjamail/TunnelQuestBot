import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { autoCompleteWatchOptionsForUnwatch } from '../commandOptions';
import { Watch } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { autocompleteWatchesWithAllWatchesOption } from '../autocomplete/autocompleteWatches';
import {
	unwatch,
	unwatchAllWatches,
	unwatchByWatchName,
} from '../../../prisma/dbExecutors/watch';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unwatch')
		.addStringOption(autoCompleteWatchOptionsForUnwatch)
		.setDescription('removes a watch'),
	async autocomplete(interaction) {
		await autocompleteWatchesWithAllWatchesOption(interaction);
	},
	execute: async (interaction) => {
		try {
			const args = getInteractionArgs(interaction, ['watch']);
			if (args?.watch?.isAutoSuggestion) {
				const value = args?.watch?.value as string;
				if (value.toUpperCase() === 'ALL WATCHES') {
					await unwatchAllWatches(interaction);
					return await interaction.reply({
						content: messageCopy.allYourWatchesHaveBeenUnwatched,
						ephemeral: true,
					});
				} else {
					// unwatch watch by id
					const watch = await unwatch(
						args?.watch?.autoSuggestionMetaData?.watch as Watch,
					);
					const embeds = [watchCommandResponseBuilder(watch)];
					const components = buttonRowBuilder(MessageTypes.watch, [
						false,
						true,
						false,
					]);
					const response = await interaction.reply({
						content: messageCopy.yourWatchHasBeenUnwatched(
							watch.itemName,
							watch.server,
						),
						embeds,
						components,
						ephemeral: true,
					});

					return await collectButtonInteractionAndReturnResponse(
						response,
						watch,
					);
				}
			} else {
				// make a good faith effort to unwatch based on raw string
				const itemName = args?.watch?.value;
				const watch = await unwatchByWatchName(
					interaction,
					itemName as string, //	TODO: fix type error
				);

				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(MessageTypes.watch, [
					false,
					true,
					false,
				]);
				const response = await interaction.reply({
					content: messageCopy.yourWatchHasBeenUnwatched(
						watch.itemName,
						watch.server,
					),
					embeds,
					components,
					ephemeral: true,
				});

				return await collectButtonInteractionAndReturnResponse(
					response,
					watch,
				);
			}
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
