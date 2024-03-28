import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('version') // the display + machine name of the command - can't be duplicated, contain spaces, or capital letters
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
