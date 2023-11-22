import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { autoCompleteWatchOptionsForInfoCommand } from '../commandOptions';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { getInteractionArgs } from '../getInteractionsArgs';
import { autocompleteWatches } from '../autocomplete/autocompleteWatches';
import { messageCopy } from '../../content/copy/messageCopy';
import {
	getWatchByItemName,
	getWatchByWatchId,
} from '../../../prisma/dbExecutors/watch';
import { Watch } from '.prisma/client';
import { isSnoozed } from '../../helpers/watches';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('info')
		.setDescription('get information on an existing watch.')
		.addStringOption(
			autoCompleteWatchOptionsForInfoCommand,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteWatches(interaction);
	},
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, ['watch']);

		// check if watch option is user submitted or from an auto suggestion
		if (args?.watch?.isAutoSuggestion) {
			const watchMetadata = args?.watch?.autoSuggestionMetaData
				?.watch as Watch;
			// if it's an auto suggestion, we can look up the watch by id
			const watch = await getWatchByWatchId(
				// TODO: we should probably create _redux types to make sure we have the expected data
				watchMetadata.id,
			);

			const embeds = [watchCommandResponseBuilder(watch)];
			const components = buttonRowBuilder(MessageTypes.watch, [
				isSnoozed(watch.snoozedUntil),
				false,
				false,
			]);

			const response = await interaction.reply({
				content: messageCopy.heresInformationOnYourWatch(
					watch.itemName,
				),
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				watch,
			);
		}

		//  if it's not an auto suggestion, let's make a good faith effort to find the watch by name
		const itemName = args?.watch?.value;

		if (itemName) {
			try {
				const watch = await getWatchByItemName(
					interaction.user.id,
					itemName as string,
				);
				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(MessageTypes.watch, [
					isSnoozed(watch.snoozedUntil),
					false,
					false,
				]);
				const response = await interaction.reply({
					content: messageCopy.heresInformationOnYourWatch(
						watch.itemName,
					),
					embeds,
					components,
				});
				return await collectButtonInteractionAndReturnResponse(
					response,
					watch,
				);
			} catch (err) {
				return await interaction.reply({
					content: messageCopy.iCouldntFindAnyWatchesForItemName(
						itemName as string,
					),
				});
			}
		}
	},
	cooldown: 3,
};

export default command;
