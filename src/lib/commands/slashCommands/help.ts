import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('help')
		.setDescription('show command information'),
	execute: async (interaction) => {
		try {
			await interaction.reply({
				content: messageCopy.helpMsg,
				ephemeral: true,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
