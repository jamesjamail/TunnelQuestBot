import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { autoCompleteWatchOptionsForSnooze } from '../lib/content/commandOptions/commandOptions';
import { autocompleteSnoozedWatches } from '../lib/helpers/autocomplete';
import { Watch } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	CommandTypes,
} from '../lib/content/buttons/buttonRowBuilder';
import { messageCopy } from '../lib/content/copy/messageCopy';
import { watchCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { unsnoozeWatch, unsnoozeWatchByItemName } from '../prisma/dbExecutors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unsnooze')
		.setDescription('unsnooze a watch')
		.addStringOption(
			autoCompleteWatchOptionsForSnooze,
		) as unknown as SlashCommandBuilder,
	async autocomplete(interaction) {
		await autocompleteSnoozedWatches(interaction);
	},
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, ['watch']);
		if (args?.watch?.isAutoSuggestion) {
			// unwatch watch by id
			const watch = await unsnoozeWatch(
				args?.watch?.autoSuggestionMetaData?.watch as Watch,
			);

			const embeds = [watchCommandResponseBuilder(watch)];
			const components = buttonRowBuilder(CommandTypes.watch);
			const response = await interaction.reply({
				content: messageCopy.yourWatchHasBeenSnoozed(),
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				watch,
			);
		} else {
			// make a good faith effort to snooze based on raw string
			const itemName = args?.watch?.value;
			// TODO: this will throw if no watch found - catch and update message accordingly
			const watch = await unsnoozeWatchByItemName(
				interaction,
				itemName as string, //	TODO: fix type error
			);

			const embeds = [watchCommandResponseBuilder(watch)];
			const components = buttonRowBuilder(CommandTypes.watch);
			const response = await interaction.reply({
				content: messageCopy.yourWatchHasBeenUnsoozed,
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
