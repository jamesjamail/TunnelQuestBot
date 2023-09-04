import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { messageCopy } from '../lib/content/copy/messageCopy';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unblock')
		.setDescription('unblock a player'),
	execute: (interaction) => {
		interaction.reply({
			content: messageCopy.helpMsg,
		});
	},
	cooldown: 10,
};

export default command;
