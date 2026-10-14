import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import type { Server } from '../../../prisma/client';
import { addPlayerBlock } from '../../../prisma/dbExecutors/block';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { blockCommandResponseBuilder } from '../../content/messages/messageBuilder';
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
		.setName('block')
		.setDescription('block a player')
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
			const server = args.server.value as Server;
			if (!enabledServers().includes(server)) {
				return await interaction.reply({
					content:
						'That server is not currently monitored. Select one of the suggested servers.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const block = await addPlayerBlock(
				interaction.user.id,
				args.player.value as string, // TODO: why is this a number?
				server,
			);

			const embeds = [blockCommandResponseBuilder(block)];
			const components = buttonRowBuilder(
				MessageTypes.block,
				[false],
				String(block.id),
			);

			return await interaction.reply({
				embeds,
				components,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
