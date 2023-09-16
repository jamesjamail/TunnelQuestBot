import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import {
	autoCompleteWatchOptionsForSnooze,
	snoozeHoursOptions,
} from '../lib/content/commandOptions/commandOptions';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { autocompleteWatches } from '../lib/helpers/autocomplete';
import {
	findOrCreateUser,
	snoozeAllWatches,
	snoozeWatch,
	snoozeWatchByItemName,
} from '../prisma/dbExecutors';
import {
	listCommandResponseBuilder,
	watchCommandResponseBuilder,
} from '../lib/content/messages/messageBuilder';
import { Watch } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import { messageCopy } from '../lib/content/copy/messageCopy';
import {
	CommandTypes,
	buttonRowBuilder,
} from '../lib/content/buttons/buttonRowBuilder';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('snooze')
		.setDescription('mute watch notifications')
		.addStringOption(autoCompleteWatchOptionsForSnooze)
		.addNumberOption(snoozeHoursOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteWatches(interaction);
	},
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, [], ['watch', 'hours']);
		const hours = args?.hours?.value;

		// check if watch option is user submitted or from an auto suggestion
		if (args?.watch?.isAutoSuggestion) {
			// if it's an auto suggestion, we know this user is snoozing a specific watch
			const watch = await snoozeWatch(
				// TODO: we should probably create _redux types to make sure we have the expected data
				args?.watch?.autoSuggestionMetaData?.watch as Watch,
				hours as number,
			);

			const embeds = [watchCommandResponseBuilder(watch)];
			const components = buttonRowBuilder(CommandTypes.watch, [
				true,
				false,
				false,
			]);
			const response = await interaction.reply({
				content: messageCopy.yourWatchHasBeenSnoozed(hours as number),
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				watch,
			);
		}

		const itemName = args?.watch?.value;

		// components below are for list responses
		const components = buttonRowBuilder(CommandTypes.list, [true, false]);
		// if it's not an auto suggestion, if there's a value for watch let's
		// try to snooze the watch by name
		if (itemName) {
			try {
				const watch = await snoozeWatchByItemName(
					interaction,
					itemName as string,
				);
				const embeds = [watchCommandResponseBuilder(watch)];
				const response = await interaction.reply({
					content: messageCopy.yourWatchHasBeenSnoozed(
						hours as number,
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

		//	if no watch option, user is activating global snooze
		const data = await snoozeAllWatches(interaction.user.id);
		const user = await findOrCreateUser(interaction.user);
		const embeds = listCommandResponseBuilder(data, user);
		const response = await interaction.reply({
			content: messageCopy.allYourWatchesHaveBeenSnoozed(hours as number),
			embeds,
			components,
		});
		return await collectButtonInteractionAndReturnResponse(response, data);
	},
	cooldown: 10,
};

export default command;
