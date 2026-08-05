import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('version')
		.setDescription('display version information'),
	execute: async (interaction) => {
		return await interaction.reply({
			content: `TunnelQuestBot version: ${process.env.npm_package_version}`,
			flags: MessageFlags.Ephemeral,
		});
	},
	cooldown: 10,
};

export default command;
