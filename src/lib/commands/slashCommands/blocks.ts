import { InteractionResponse, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { blockCommandResponseBuilder } from '../../content/messages/messageBuilder';
import { blockFilterOptions } from '../commandOptions';
import { getPlayerBlocks } from '../../../prisma/dbExecutors/block';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('blocks')
		.setDescription('show blocked players')
		.addStringOption(blockFilterOptions) as unknown as SlashCommandBuilder,
	execute: async (interaction) => {
		try {
			// defer reply immediately as it may take a while to send blocks
			await interaction.deferReply();
			const args = getInteractionArgs(interaction, [], ['filter']);
			const data = await getPlayerBlocks(
				interaction.user.id,
				args?.filter?.value as string,
			);

			// edge case if user has no blocks
			if (data.length === 0) {
				return await interaction.editReply(
					messageCopy.youDontHaveAnyBlocks(
						args?.filter?.value as string,
					),
				);
			}

			let lastDmChannelId = '';

			await Promise.all(
				data.map(async (block) => {
					const embeds = [blockCommandResponseBuilder(block)];
					const components = buttonRowBuilder(MessageTypes.block);

					const message = await interaction.user.send({
						embeds,
						components,
					});

					lastDmChannelId = message.channelId;
					await collectButtonInteractionAndReturnResponse(
						message as unknown as InteractionResponse<boolean>,
						block,
					);
				}),
			);

			// If the command was executed from a DM don't link to DM
			if (!interaction.inGuild()) {
				return await interaction.editReply('Here you go...');
			}

			const response = await interaction.editReply(
				messageCopy.blocksHaveBeenDeliveredViaDm(
					data.length,
					lastDmChannelId,
				),
			);

			// Set a timeout to delete the reply after 10 seconds
			return setTimeout(async () => {
				await response.delete();
			}, 10000);
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
