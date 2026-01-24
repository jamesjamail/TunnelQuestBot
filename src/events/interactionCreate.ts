import { Interaction } from 'discord.js';
import { BotEvent } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';

const event: BotEvent = {
	name: 'interactionCreate',
	execute: async (interaction: Interaction) => {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.slashCommands.get(
				interaction.commandName,
			);
			const cooldown = interaction.client.cooldowns.get(
				`${interaction.commandName}-${interaction.user.username}`,
			);
			if (!command) return;
			if (command.cooldown && cooldown) {
				if (Date.now() < cooldown) {
					interaction.reply({
						content: `You have to wait ${Math.floor(
							Math.abs(Date.now() - cooldown) / 1000,
						)} second(s) to use this command again.`,
						ephemeral: true,
					});
					setTimeout(() => interaction.deleteReply(), 5000);
					return;
				}
				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000,
				);
				setTimeout(() => {
					interaction.client.cooldowns.delete(
						`${interaction.commandName}-${interaction.user.username}`,
					);
				}, command.cooldown * 1000);
			} else if (command.cooldown && !cooldown) {
				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000,
				);
			}
			try {
				command.execute(interaction);
			} catch (e) {
				await gracefullyHandleError(e, interaction, command);
			}
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.slashCommands.get(
				interaction.commandName,
			);
			if (!command) {
				console.error(
					`No command matching ${interaction.commandName} was found.`,
				);
				return;
			}
			try {
				if (!command.autocomplete) return;
				command.autocomplete(interaction);
			} catch (error) {
				await gracefullyHandleError(error, interaction, command);
			}
		}
	},
};

export default event;
