import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { Server } from '@prisma/client';
import {
	playerNameOptions,
	requiredsServerOptions,
} from '../lib/content/commandOptions/commandOptions';
import { removePlayerLink } from '../prisma/dbExecutors';
import { getInteractionArgs } from '../lib/helpers/helpers';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unlink')
		.setDescription('unlink a character from your discord user')
		.addStringOption(playerNameOptions)
		.addStringOption(
			requiredsServerOptions,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, ['player', 'server']);
		const player_name = args.player.value as string;
		const server = args.server.value as Server;
		const success = await removePlayerLink(
			interaction.user.id,
			player_name,
			server,
		);
		// console.log(`Character ${server}.${player_name} unlinked from ${interaction.user.username}`)
		let user_message;
		if (success) {
			user_message = `Successfully unlinked character ${server}.${player_name} from your discord user.`;
		} else {
			user_message = `No such character link exists to your discord user.`;
		}
		await interaction.reply({
			content: user_message,
			ephemeral: true,
		});
	},
	cooldown: 3,
};

export default command;
