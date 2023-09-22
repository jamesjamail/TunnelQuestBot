import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { addPlayerBlock, findOrCreateUser } from '../prisma/dbExecutors';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import { getInteractionArgs } from '../lib/helpers/helpers';
import {
	playerNameOptions,
	requiredsServerOptions,
} from '../lib/content/commandOptions/commandOptions';
import { blockCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { Server } from '@prisma/client';

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

		console.log(args);
		// TODO: would be nice to eventually allow server to be optional, and block
		//  player on all servers if omitted
		const block = await addPlayerBlock(
			interaction.user.id,
			args.player.value as string, // TODO: why is this a number?
			args.server.value as Server,
		);

		const embeds = [blockCommandResponseBuilder(block)];
		// const components = buttonRowBuilder(CommandTypes.watch);

		const response = await interaction.reply({
			embeds,
			// components,
		});

		return await collectButtonInteractionAndReturnResponse(response, block);
	},
	cooldown: 10,
};

export default command;
