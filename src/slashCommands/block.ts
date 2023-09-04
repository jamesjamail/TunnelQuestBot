import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('block')
		.setDescription('block a player'),
	execute: (interaction) => {
		interaction.reply({
			content: 'block', //  TODO: fix
		});
	},
	cooldown: 10,
};

export default command;
