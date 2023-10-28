import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { PlayerLink, Server } from '@prisma/client';
import {
	playerNameOptions,
	requiredsServerOptions,
} from '../lib/content/commandOptions/commandOptions';
import { removePlayerLink } from '../prisma/dbExecutors';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { messageCopy } from '../lib/content/copy/messageCopy';

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
			user_message = messageCopy.soAndSoHasBeenUnlinked({
				server: server,
				player: player_name,
			} as PlayerLink);
		} else {
			user_message = messageCopy.soAndSoHasFailedToBeUnlinked({
				server: server,
				player: player_name,
			} as PlayerLink);
		}
		await interaction.reply({
			content: user_message,
			ephemeral: true,
		});
	},
	cooldown: 3,
};

export default command;
