import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('list')
		.setDescription('list watches in a concise format'),
	execute: (interaction) => {
		interaction.reply({
			content: 'list', //  TODO: fix
		});
	},
	cooldown: 10,
};

export default command;
