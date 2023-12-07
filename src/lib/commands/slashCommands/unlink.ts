import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { PlayerLink, Server } from '@prisma/client';
import { messageCopy } from '../../content/copy/messageCopy';
import { removePlayerLink } from '../../../prisma/dbExecutors/playerLink';
import { playerNameOptions, requiredsServerOptions } from '../commandOptions';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unlink')
		.setDescription('unlink a character from your discord user')
		.addStringOption(playerNameOptions)
		.addStringOption(
			requiredsServerOptions,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	execute: async (interaction) => {
		try {
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
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 3,
};

export default command;
