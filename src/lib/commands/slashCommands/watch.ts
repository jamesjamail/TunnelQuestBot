import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { Server, WatchType } from '@prisma/client';
import {
	requiredsServerOptions,
	watchTypeOptions,
	priceCriteriaOptions,
	autoCompleteItemNameOptions,
	watchNotesOptions,
} from '../commandOptions';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { autocompleteItems } from '../autocomplete/autocompleteItems';
import { upsertWatchSafely } from '../../../prisma/dbExecutors/watch';
import { getInteractionArgs } from '../getInteractionsArgs';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('add or modify a watch.')
		.addStringOption(watchTypeOptions)
		.addStringOption(autoCompleteItemNameOptions)
		.addStringOption(requiredsServerOptions)
		.addNumberOption(priceCriteriaOptions)
		.addStringOption(watchNotesOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	async autocomplete(interaction) {
		await autocompleteItems(interaction);
	},
	execute: async (interaction) => {
		const args = getInteractionArgs(
			interaction,
			['server', 'item', 'type'],
			['notes'],
		);
		const data = await upsertWatchSafely(interaction, {
			server: args.server.value as Server,
			itemName: args.item.value as string,
			watchType: args.type.value as WatchType,
			notes: args?.notes?.value as string,
		});

		const embeds = [watchCommandResponseBuilder(data)];
		const components = buttonRowBuilder(MessageTypes.watch);

		const response = await interaction.reply({
			embeds,
			components,
		});

		return await collectButtonInteractionAndReturnResponse(response, data);
	},
	cooldown: 3,
};

export default command;
