import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { Server, WatchType } from '@prisma/client';
import {
	itemNameOptions,
	serverOptions,
	watchTypeOptions,
	priceCriteriaOptions,
} from '../lib/content/commandOptions/commandOptions';
import { watchCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	CommandTypes,
	buttonRowBuilder,
} from '../lib/content/buttons/buttonRowBuilder';
import { findOrCreateUser, upsertWatch } from '../prisma/dbExecutors';
import { getInteractionArgs } from '../lib/helpers/helpers';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('add or modify a watch.')
		.addStringOption(watchTypeOptions)
		.addStringOption(itemNameOptions)
		.addStringOption(serverOptions)
		.addNumberOption(
			priceCriteriaOptions,
		) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, [
			'server',
			'item',
			'type',
		]);
		const user = await findOrCreateUser(interaction.user);
		const data = await upsertWatch(user.discordUserId, {
			server: args.server.value as Server,
			itemName: args.item.value as string,
			watchType: args.type.value as WatchType,
		});

		const embeds = [watchCommandResponseBuilder(data)];
		const components = buttonRowBuilder(CommandTypes.watch);

		const response = await interaction.reply({
			embeds,
			components,
		});

		return await collectButtonInteractionAndReturnResponse(response, data);
	},
	cooldown: 3,
};

export default command;
