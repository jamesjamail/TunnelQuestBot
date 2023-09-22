import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { findOrCreateUser, getWatchesByUser } from '../prisma/dbExecutors';
import { listCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	CommandTypes,
	buttonRowBuilder,
} from '../lib/content/buttons/buttonRowBuilder';
import { isSnoozed } from '../lib/helpers/helpers';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('list')
		.setDescription('list watches in a concise format'),
	execute: async (interaction) => {
		const user = await findOrCreateUser(interaction.user);
		const watches = await getWatchesByUser(interaction.user.id);

		if (watches.length === 0) {
			return await interaction.reply(
				`You don't have any watches.  Add some with \`/watch\``,
			);
		}

		const globalSnoozeActive = isSnoozed(user.snoozedUntil);

		const embeds = listCommandResponseBuilder(watches);
		const components = buttonRowBuilder(CommandTypes.list, [
			globalSnoozeActive,
			false,
		]);
		const response = await interaction.reply({
			content: `Here's a list of your watches organized by server`,
			embeds,
			components,
		});

		return await collectButtonInteractionAndReturnResponse(response, user);
	},
	cooldown: 10,
};

export default command;
