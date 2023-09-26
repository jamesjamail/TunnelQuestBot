import { SlashCommand } from '../types';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	CommandTypes,
	buttonRowBuilder,
} from '../lib/content/buttons/buttonRowBuilder';
import { getWatchesByItemName } from '../prisma/dbExecutors';
import { watchFilterOptions } from '../lib/content/commandOptions/commandOptions';
import { InteractionResponse, SlashCommandBuilder } from 'discord.js';
import { watchCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { messageCopy } from '../lib/content/copy/messageCopy';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watches')
		.setDescription('show watches')
		.addStringOption(watchFilterOptions) as unknown as SlashCommandBuilder, //chaining commands confuses typescript...
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, [], ['filter']);

		const data = await getWatchesByItemName(
			interaction.user.id,
			args?.filter?.value as string,
		);

		await Promise.all(
			data.map(async (watch) => {
				const embeds = [watchCommandResponseBuilder(watch)];
				const components = buttonRowBuilder(CommandTypes.watch);

				const message = await interaction.user.send({
					embeds,
					components,
				});
				await collectButtonInteractionAndReturnResponse(
					message as unknown as InteractionResponse<boolean>,
					watch,
				);
			}),
		);

		// If the command was executed from a DM don't inform users watches were sent via DM
		if (!interaction.inGuild()) {
			return await interaction.reply('Here you go...');
		}

		const response = await interaction.reply(
			messageCopy.watchesHaveBeenDeliveredViaDm(data.length),
		);

		// Set a timeout to delete the reply after 5 seconds
		return setTimeout(async () => {
			await response.delete();
		}, 5000);
	},
	cooldown: 10,
};

export default command;
