import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watches')
		.setDescription('show watches'),
	execute: (interaction) => {
		interaction.reply({
			content: 'watches',
		});
	},
	cooldown: 10,
};

export default command;
