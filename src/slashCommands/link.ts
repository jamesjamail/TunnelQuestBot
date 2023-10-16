import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { insertPlayerLinkSafely } from '../prisma/dbExecutors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('link')
		.setDescription('link a character to your discord ID.'),
	execute: async (interaction) => {
		const linkCode = await insertPlayerLinkSafely(interaction);
		// console.log(`Auth code generated for user ${interaction.user.id}: ${linkCode}`)
		const user_message =
			'To link your character, send the following message in EC ' +
			`within one hour:\n\`/ooc Link me: ${linkCode}\``;
		await interaction.reply({
			content: user_message,
			ephemeral: true,
		});
	},
	cooldown: 10,
};

export default command;