import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('version')
		.setDescription('display version information'),
	execute: (interaction) => {
		interaction.reply({
			content: `TunnelQuestBot version: ${process.env.npm_package_version}`,
			ephemeral: true,
		});
	},
	cooldown: 10,
};

export default command;
