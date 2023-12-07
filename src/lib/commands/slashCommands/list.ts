import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { listCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { isSnoozed } from '../../helpers/watches';
import { messageCopy } from '../../content/copy/messageCopy';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import { getWatchesByUser } from '../../../prisma/dbExecutors/watch';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('list')
		.setDescription('list watches in a concise format'),
	execute: async (interaction) => {
		try {
			const user = await findOrCreateUser(interaction.user);
			const watches = await getWatchesByUser(interaction.user.id);

			if (watches.length === 0) {
				return await interaction.reply(
					`You don't have any watches.  Add some with \`/watch\``,
				);
			}

			const globalSnoozeActive = isSnoozed(user.snoozedUntil);

			const embeds = listCommandResponseBuilder(watches, user);

			const components = buttonRowBuilder(MessageTypes.list, [
				globalSnoozeActive,
				false,
			]);
			const response = await interaction.reply({
				content: messageCopy.heresAListOfYourWatches,
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				user,
			);
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
