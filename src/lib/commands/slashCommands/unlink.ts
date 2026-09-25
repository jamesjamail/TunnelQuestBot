import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import type { PlayerLink, Server } from '../../../prisma/client';
import { messageCopy } from '../../content/copy/messageCopy';
import { removePlayerLink } from '../../../prisma/dbExecutors/playerLink';
import {
	playerNameOptions,
	autoCompleteServerOptions,
} from '../commandOptions';
import { autocompleteServers } from '../autocomplete/autocompleteServers';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';
import { enabledServers } from '../../../config';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unlink')
		.setDescription('unlink a character from your discord user')
		.addStringOption(playerNameOptions)
		.addStringOption(
			autoCompleteServerOptions,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteServers(interaction);
	},
	execute: async (interaction) => {
		try {
			const args = getInteractionArgs(interaction, ['player', 'server']);
			const player_name = args.player.value as string;
			const server = args.server.value as Server;
			if (!enabledServers().includes(server)) {
				return await interaction.reply({
					content:
						'That server is not currently monitored. Select one of the suggested servers.',
					flags: MessageFlags.Ephemeral,
				});
			}
			const success = await removePlayerLink(
				interaction.user.id,
				player_name,
				server,
			);
			let user_message: string;
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
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 3,
};

export default command;
