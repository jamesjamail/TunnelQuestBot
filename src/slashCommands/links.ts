import { InteractionResponse, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { getPlayerLinksForUser } from '../prisma/dbExecutors';
import { playerlinkCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import {
	buttonRowBuilder,
	CommandTypes,
} from '../lib/content/buttons/buttonRowBuilder';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import { messageCopy } from '../lib/content/copy/messageCopy';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('links')
		.setDescription('show characters linked to your discord user'),
	execute: async (interaction) => {
		await interaction.deferReply();

		const data = await getPlayerLinksForUser(interaction.user.id);
		// console.log(`Retrieved ${data.length} links for user ${interaction.user.id}.`);

		let lastDmChannelId = '';

		await Promise.all(
			data.map(async (link) => {
				const embed = playerlinkCommandResponseBuilder(link);
				if (embed != undefined) {
					const embeds = [embed];
					const components = buttonRowBuilder(CommandTypes.link);

					const message = await interaction.user.send({
						embeds,
						components,
					});

					lastDmChannelId = message.channelId;
					await collectButtonInteractionAndReturnResponse(
						message as unknown as InteractionResponse<boolean>,
						link,
					);
				}
			}),
		);

		// If the command was executed from a DM don't link to DM
		if (!interaction.inGuild()) {
			return await interaction.editReply('Here you go...');
		}

		const response = await interaction.editReply(
			messageCopy.linksHaveBeenDeliveredViaDm(
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
