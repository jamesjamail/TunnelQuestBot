import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('snooze')
		.setDescription('mute watch notifications'),
	execute: (interaction) => {
		interaction.reply({
			content: 'snooze', //  TODO: fix
		});
	},
	cooldown: 10,
};

export default command;
