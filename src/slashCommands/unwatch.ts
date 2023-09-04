import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unwatch')
		.setDescription('removes a watch'),
	execute: (interaction) => {
		interaction.reply({
			content: 'unwatch',
		});
	},
	cooldown: 10,
};

export default command;
