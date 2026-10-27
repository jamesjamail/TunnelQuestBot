import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import { addTraderBlock } from '../../../prisma/dbExecutors/block';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import { messageCopy } from '../../content/copy/messageCopy';
import { traderOptions } from '../commandOptions';
import { gracefullyHandleError } from '../../helpers/errors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('blocktrader')
		.setDescription('block a discord user from marketplace matching')
		.addUserOption(traderOptions) as unknown as SlashCommandBuilder, // chaining commands confuses typescript =(
	execute: async (interaction) => {
		try {
			const target = interaction.options.getUser('user', true);

			if (target.id === interaction.user.id) {
				return await interaction.reply({
					content: messageCopy.youCantBlockYourself,
					flags: MessageFlags.Ephemeral,
				});
			}

			await findOrCreateUser(interaction.user);
			await addTraderBlock(interaction.user.id, target.id);

			return await interaction.reply({
				content: messageCopy.traderHasBeenBlocked(target.id),
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
