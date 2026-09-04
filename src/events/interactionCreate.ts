import { type Interaction, MessageFlags } from 'discord.js';
import type { BotEvent } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';
import { handleButtonInteraction } from '../lib/content/buttons/persistentButtonHandler';

const event: BotEvent = {
	name: 'interactionCreate',
	execute: async (interaction: Interaction) => {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.slashCommands.get(
				interaction.commandName,
			);
			const cooldownKey = `${interaction.commandName}-${interaction.user.id}`;
			const cooldown = interaction.client.cooldowns.get(cooldownKey);
			if (!command) return;
			if (command.cooldown && cooldown && Date.now() < cooldown) {
				const secondsLeft = Math.max(
					1,
					Math.ceil((cooldown - Date.now()) / 1000),
				);
				await interaction.reply({
					content: `You have to wait ${secondsLeft} second(s) to use this command again.`,
					flags: MessageFlags.Ephemeral,
				});
				setTimeout(() => {
					void interaction.deleteReply().catch(() => null);
				}, 5000);
				return;
			}
			if (command.cooldown) {
				interaction.client.cooldowns.set(
					cooldownKey,
					Date.now() + command.cooldown * 1000,
				);
				setTimeout(() => {
					interaction.client.cooldowns.delete(cooldownKey);
				}, command.cooldown * 1000);
			}
			try {
				await command.execute(interaction);
			} catch (e) {
				await gracefullyHandleError(e, interaction, command);
			}
		} else if (interaction.isButton()) {
			try {
				await handleButtonInteraction(interaction);
			} catch (error) {
				await gracefullyHandleError(error, interaction);
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
				await command.autocomplete(interaction);
			} catch (error) {
				await gracefullyHandleError(error, interaction, command);
			}
		}
	},
};

export default event;
