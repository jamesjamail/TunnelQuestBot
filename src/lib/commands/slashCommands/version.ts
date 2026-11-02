import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import { tunnelQuestVersion } from '../../devVersion';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('version')
		.setDescription('display version information'),
	execute: async (interaction) => {
		try {
			const version = tunnelQuestVersion(
				process.env.TUNNELQUESTBOT_VERSION,
			);
			return await interaction.reply({
				content: `TunnelQuestBot version: ${version}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
