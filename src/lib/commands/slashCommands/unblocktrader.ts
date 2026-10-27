import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import { removeTraderBlock } from '../../../prisma/dbExecutors/block';
import { messageCopy } from '../../content/copy/messageCopy';
import { traderOptions } from '../commandOptions';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unblocktrader')
		.setDescription('unblock a discord user from marketplace matching')
		.addUserOption(traderOptions) as unknown as SlashCommandBuilder,
	execute: async (interaction) => {
		try {
			const target = interaction.options.getUser('user', true);

			const removed = await removeTraderBlock(
				interaction.user.id,
				target.id,
			);

			return await interaction.reply({
				content: removed
					? messageCopy.traderHasBeenUnblocked(target.id)
					: messageCopy.traderWasNotBlocked(target.id),
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
