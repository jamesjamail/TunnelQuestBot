import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import {
	autoCompleteWatchOptionsForSnooze,
	snoozeHoursOptions,
} from '../commandOptions';
import {
	listCommandResponseBuilder,
	watchCommandResponseBuilder,
} from '../../content/messages/messageBuilder';
import type { Watch } from '../../../prisma/client';
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
				return await interaction.reply({
					content: messageCopy.allYourWatchesHaveBeenSnoozed(
						hours as number,
					),
					embeds,
					components,
					flags: MessageFlags.Ephemeral,
				});
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
				const components = buttonRowBuilder(
					MessageTypes.watch,
					[true, false, false],
					String(watch.id),
				);
				return await interaction.reply({
					content: messageCopy.yourWatchHasBeenSnoozed(
						hours as number,
					),
					embeds,
					components,
					flags: MessageFlags.Ephemeral,
				});
			}

			const itemName = args?.watch?.value;

			// if it's not an auto suggestion, if there's a value for watch let's
			// try to snooze the watch by name
			if (itemName) {
				try {
					const watch = await snoozeWatchByItemName(
						interaction,
						itemName as string,
					);
					const embeds = [watchCommandResponseBuilder(watch)];
					const components = buttonRowBuilder(
						MessageTypes.watch,
						[true, false, false],
						String(watch.id),
					);
					return await interaction.reply({
						content: messageCopy.yourWatchHasBeenSnoozed(
							hours as number,
						),
						embeds,
						components,
						flags: MessageFlags.Ephemeral,
					});
				} catch {
					return await interaction.reply({
						content: messageCopy.iCouldntFindAnyWatchesForItemName(
							itemName as string,
						),
						flags: MessageFlags.Ephemeral,
					});
				}
			}

			return await interaction.reply({
				content: `You didn't enter an item name. Instead of selecting the option \`start typing an item name for suggestions\`, either select a suggested option or enter your own.`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
