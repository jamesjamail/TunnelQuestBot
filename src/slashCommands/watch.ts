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
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonCollector';
import {
	CommandTypes,
	buttonRowBuilder,
} from '../lib/content/buttons/buttonRowBuilder';
import { findOrCreateUser, upsertWatch } from '../lib/helpers/dbExecutors';
import { getInteractionArgs } from '../lib/helpers/helpers';

type Args = {
	item: string;
	server: Server;
	type: WatchType;
};

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
		// TODO: when a user upserts a watch, it should not be snoozed
		const args: Args = getInteractionArgs(interaction, [
			'server',
			'item',
			'type',
		]);
		const user = await findOrCreateUser(interaction.user);
		const data = await upsertWatch(user.discordUserId, {
			server: args.server,
			itemName: args.item,
			watchType: args.type,
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
