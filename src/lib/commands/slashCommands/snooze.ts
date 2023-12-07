import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import {
	autoCompleteWatchOptionsForSnooze,
	snoozeHoursOptions,
} from '../commandOptions';
import {
	listCommandResponseBuilder,
	watchCommandResponseBuilder,
} from '../../content/messages/messageBuilder';
import { Watch } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import { messageCopy } from '../../content/copy/messageCopy';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { autocompleteWatchesWithAllWatchesOption } from '../autocomplete/autocompleteWatches';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import {
	snoozeAllWatches,
	snoozeWatch,
	snoozeWatchByItemName,
} from '../../../prisma/dbExecutors/watch';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('snooze')
		.setDescription('mute watch notifications')
		.addStringOption(autoCompleteWatchOptionsForSnooze)
		.addNumberOption(snoozeHoursOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteWatchesWithAllWatchesOption(interaction);
	},
	execute: async (interaction) => {
		try {
			const args = getInteractionArgs(interaction, ['watch'], ['hours']);
			const hours = args?.hours?.value;
			const value = args.watch.value as string;
			if (value.toUpperCase() === 'ALL WATCHES') {
				const data = await snoozeAllWatches(interaction.user.id);
				const user = await findOrCreateUser(interaction.user);
				const embeds = listCommandResponseBuilder(data, user);
				const components = buttonRowBuilder(MessageTypes.list, [
					true,
					false,
				]);
				const response = await interaction.reply({
					content: messageCopy.allYourWatchesHaveBeenSnoozed(
						hours as number,
					),
					embeds,
					components,
				});
				return await collectButtonInteractionAndReturnResponse(
					response,
					data,
				);
			}
			// check if watch option is user submitted or from an auto suggestion
			if (args?.watch?.isAutoSuggestion) {
				// if it's an auto suggestion and not ALL WATCHES, we know this user is snoozing a specific watch
				const watch = await snoozeWatch(
					// TODO: we should probably create _redux types to make sure we have the expected data
					args?.watch?.autoSuggestionMetaData?.watch as Watch,
					hours as number,
				);

				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(MessageTypes.watch, [
					true,
					false,
					false,
				]);
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
			}

			const itemName = args?.watch?.value;

			// components below are for list responses
			const components = buttonRowBuilder(MessageTypes.list, [
				true,
				false,
			]);
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
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
