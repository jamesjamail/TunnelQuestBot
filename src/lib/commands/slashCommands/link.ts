import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { insertPlayerLinkSafely } from '../../../prisma/dbExecutors/playerLink';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('link')
		.setDescription('link a character to your discord user'),
	execute: async (interaction) => {
		try {
			const linkCode = await insertPlayerLinkSafely(interaction);
			const user_message =
				'To link your character, send the following message in EC ' +
				`within one hour:\n\`/ooc Link me: ${linkCode}\``;
			await interaction.reply({
				content: user_message,
				ephemeral: true,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 60 * 5,
};

export default command;
