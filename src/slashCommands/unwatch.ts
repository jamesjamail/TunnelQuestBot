import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { autoCompleteWatchOptionsForUnwatch } from '../lib/content/commandOptions/commandOptions';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { unwatch, unwatchByWatchName } from '../prisma/dbExecutors';
import { Watch } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../lib/content/buttons/buttonRowBuilder';
import { messageCopy } from '../lib/content/copy/messageCopy';
import { watchCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { autocompleteWatches } from '../lib/helpers/autocomplete';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unwatch')
		.addStringOption(autoCompleteWatchOptionsForUnwatch)
		.setDescription('removes a watch'),
	async autocomplete(interaction) {
		await autocompleteWatches(interaction);
	},
	execute: async (interaction) => {
		// TODO: add a "all watches" value first on the list and handle that accordingly
		const args = getInteractionArgs(interaction, ['watch']);
		if (args?.watch?.isAutoSuggestion) {
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
				content: messageCopy.yourWatchHasBeenUnwatched,
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				watch,
			);
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
				content: messageCopy.yourWatchHasBeenUnwatched,
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				watch,
			);
		}
	},
	cooldown: 10,
};

export default command;
