import {
	ButtonInteraction,
	CacheType,
	ChannelSelectMenuInteraction,
	DiscordAPIError,
	Interaction,
	MentionableSelectMenuInteraction,
	Message,
	MessageComponentInteraction,
	RoleSelectMenuInteraction,
	StringSelectMenuInteraction,
	UserSelectMenuInteraction,
} from 'discord.js';
import { buttonBuilder, ButtonInteractionTypes } from './buttonBuilder';
import { MessageTypes, buttonRowBuilder } from './buttonRowBuilder';
import { gracefullyHandleError } from '../../helpers/errors';

export async function removeInteractionContentAfterDelay(
	interaction: ButtonInteraction | MessageComponentInteraction,
	delay: number = 5000,
) {
	setTimeout(async () => {
		await interaction.deleteReply();
	}, delay);
}

export async function confirmButtonInteraction(
	interaction: Interaction,
	confirmedAction: (
		followUpMessage: Message<boolean>,
		interaction: ButtonInteraction,
	) => Promise<void>,
	confirmationMessage: string,
	commandType: MessageTypes,
) {
	const updatedComponents = buttonRowBuilder(commandType);
	if (!interaction.isButton()) {
		throw new Error('Expected a button interaction');
	}

	// Build buttons using buttonBuilder
	const buttons = buttonBuilder([
		{ type: ButtonInteractionTypes.ConfirmActionActive },
		{ type: ButtonInteractionTypes.CancelActionActive },
	]);

	// Defer reply and follow up with the message
	await interaction.deferUpdate();
	// TODO: whatever button was clicked should be active
	// we need a way to determine which buttons corelate to which button interactions
	// probably easiest to accept ButtonInteractionTypes as extra argument
	const buttonRowWithActiveButton = buttonRowBuilder(commandType);

	await interaction.editReply({ components: buttonRowWithActiveButton });

	const followUp = await interaction.followUp({
		content: confirmationMessage,
		components: buttons,
	});

	const filter = (
		i:
			| ButtonInteraction
			| StringSelectMenuInteraction<CacheType>
			| UserSelectMenuInteraction<CacheType>
			| RoleSelectMenuInteraction<CacheType>
			| MentionableSelectMenuInteraction<CacheType>
			| ChannelSelectMenuInteraction<CacheType>,
	) => {
		if (!i.isButton()) return false;
		return [
			ButtonInteractionTypes[ButtonInteractionTypes.ConfirmActionActive],
			ButtonInteractionTypes[ButtonInteractionTypes.CancelActionActive],
		].includes(i.customId);
	};

	try {
		const collected = await followUp.awaitMessageComponent({
			filter,
			time: 10000,
		});

		if (!collected.isButton()) {
			throw new Error('collected interaction is a button');
		}

		// linter rule doesn't like declarations in cases
		const potentialError = `Unknown customId: ${collected.customId}`;

		switch (collected.customId) {
			case 'ConfirmActionActive':
				return await confirmedAction(followUp, collected); // Perform the confirmed action.
				break;
			case 'CancelActionActive':
				// Revert to original state
				await followUp.delete();
				await interaction.editReply({
					components: updatedComponents,
				});
				break;
			default:
				throw new Error(potentialError);
		}

		// handle collected interaction...
	} catch (error) {
		// this is the error on /watches unwatch button interaction
		if (error instanceof DiscordAPIError && error.code === 10062) {
			// eslint-disable-next-line no-console
			const informativeError = new Error(
				'Unknown interaction error received while confirming button interaction.  This is likely due to duplicate button interactions.',
			);
			await gracefullyHandleError(informativeError);
		} else if (
			error instanceof Error && // TypeScript way to ensure `error` has `message` property.
			!error.message.includes(
				'Collector received no interactions before ending with reason: time',
			)
		) {
			// log error
			await gracefullyHandleError(error, interaction);
			// Revert to original state
			await followUp.delete();
			await interaction.editReply({
				components: updatedComponents,
			});
		}
	}
}
