import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('blocks')
		.setDescription('show blocked players'),
	execute: (interaction) => {
		interaction.reply({
			content: 'blocks', //  TODO: fix
		});
	},
	cooldown: 10,
};

export default command;
