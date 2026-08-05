import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { autoCompleteWatchOptionsForSnooze } from '../commandOptions';
import { Watch } from '@prisma/client';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { autocompleteSnoozedWatches } from '../autocomplete/autocompleteSnoozedWatches';
import {
	unsnoozeWatch,
	unsnoozeWatchByItemName,
} from '../../../prisma/dbExecutors/watch';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

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
		try {
			const args = getInteractionArgs(interaction, ['watch']);
			if (args?.watch?.isAutoSuggestion) {
				// unwatch watch by id
				const watch = await unsnoozeWatch(
					args?.watch?.autoSuggestionMetaData?.watch as Watch,
				);

				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(
					MessageTypes.watch,
					[false, false, false],
					String(watch.id),
				);
				return await interaction.reply({
					content: messageCopy.yourWatchHasBeenUnsnoozed,
					embeds,
					components,
					flags: MessageFlags.Ephemeral,
				});
			} else {
				// make a good faith effort to snooze based on raw string
				const itemName = args?.watch?.value;
				// TODO: this will throw if no watch found - catch and update message accordingly
				const watch = await unsnoozeWatchByItemName(
					interaction,
					itemName as string, //	TODO: fix type error
				);

				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(
					MessageTypes.watch,
					[false, false, false],
					String(watch.id),
				);
				return await interaction.reply({
					content: messageCopy.yourWatchHasBeenUnsnoozed,
					embeds,
					components,
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
