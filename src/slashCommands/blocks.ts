import { InteractionResponse, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	CommandTypes,
} from '../lib/content/buttons/buttonRowBuilder';
import { messageCopy } from '../lib/content/copy/messageCopy';
import { blockCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { getInteractionArgs } from '../lib/helpers/helpers';
import { getPlayerBlocks } from '../prisma/dbExecutors';
import { blockFilterOptions } from '../lib/content/commandOptions/commandOptions';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('blocks')
		.setDescription('show blocked players')
		.addStringOption(blockFilterOptions) as unknown as SlashCommandBuilder,
	execute: async (interaction) => {
		// defer reply immediately as it may take a while to send blocks
		await interaction.deferReply();
		const args = getInteractionArgs(interaction, [], ['filter']);

		const data = await getPlayerBlocks(
			interaction.user.id,
			args?.filter?.value as string,
		);

		let lastDmChannelId = '';

		await Promise.all(
			data.map(async (block) => {
				const embeds = [blockCommandResponseBuilder(block)];
				const components = buttonRowBuilder(CommandTypes.block);

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
	},
	cooldown: 10,
};

export default command;
