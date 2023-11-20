import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { Server } from '@prisma/client';
import { addPlayerBlock } from '../../../prisma/dbExecutors/block';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { blockCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { playerNameOptions, requiredsServerOptions } from '../commandOptions';
import { getInteractionArgs } from '../getInteractionsArgs';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('block')
		.setDescription('block a player')
		.addStringOption(playerNameOptions)
		.addStringOption(
			requiredsServerOptions,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, ['player', 'server']);

		const block = await addPlayerBlock(
			interaction.user.id,
			args.player.value as string, // TODO: why is this a number?
			args.server.value as Server,
		);

		const embeds = [blockCommandResponseBuilder(block)];
		const components = buttonRowBuilder(MessageTypes.block);

		const response = await interaction.reply({
			embeds,
			components,
		});

		return await collectButtonInteractionAndReturnResponse(response, block);
	},
	cooldown: 10,
};

export default command;
