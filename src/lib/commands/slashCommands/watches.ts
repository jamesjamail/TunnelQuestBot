import { SlashCommand } from '../../../types';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../../content/buttons/buttonRowBuilder';
import { watchFilterOptions } from '../commandOptions';
import { InteractionResponse, SlashCommandBuilder } from 'discord.js';
import { watchCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { getWatchesByItemName } from '../../../prisma/dbExecutors/watch';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('watches')
		.setDescription('show watches')
		.addStringOption(watchFilterOptions) as unknown as SlashCommandBuilder, //chaining commands confuses typescript...
	execute: async (interaction) => {
		try {
			// defer reply immediately as it may take a while to send watches
			await interaction.deferReply({
				ephemeral: true,
			});
			const args = getInteractionArgs(interaction, [], ['filter']);

			const data = await getWatchesByItemName(
				interaction.user.id,
				args?.filter?.value as string,
			);

			let lastDmChannelId = '';

			await Promise.all(
				data.map(async (watch) => {
					const embeds = [watchCommandResponseBuilder(watch)];
					const components = buttonRowBuilder(MessageTypes.watch);

					const message = await interaction.user.send({
						embeds,
						components,
					});

					lastDmChannelId = message.channelId;
					await collectButtonInteractionAndReturnResponse(
						message as unknown as InteractionResponse<boolean>,
						watch,
					);
				}),
			);

			// If the command was executed from a DM don't link to DM
			if (!interaction.inGuild()) {
				return await interaction.editReply('Here you go...');
			}

			return await interaction.editReply(
				messageCopy.watchesHaveBeenDeliveredViaDm(
					data.length,
					lastDmChannelId,
				),
			);
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
