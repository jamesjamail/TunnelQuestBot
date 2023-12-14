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
	if (!interaction.isButton()) {
		throw new Error('Expected a button interaction');
	}

	// Build buttons using buttonBuilder
	const buttons = buttonBuilder([
		{ type: ButtonInteractionTypes.ConfirmActionActive },
		{ type: ButtonInteractionTypes.CancelActionActive },
	]);

	let followUp;

	const buttonRowWithActiveButton = buttonRowBuilder(commandType);
	const update = await interaction
		.update({ components: buttonRowWithActiveButton })
		.catch((e) => {console.error('error updating: ', e)});

	if (!update) {
		return;
	}

	try {
		followUp = await interaction.followUp({
			content: confirmationMessage,
			components: buttons,
		});

		// Filter for button interactions
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
				ButtonInteractionTypes[
					ButtonInteractionTypes.ConfirmActionActive
				],
				ButtonInteractionTypes[
					ButtonInteractionTypes.CancelActionActive
				],
			].includes(i.customId);
		};

		try {
			const collected = await followUp.awaitMessageComponent({
				filter,
				time: 10000,
			});

			if (!collected.isButton()) {
				throw new Error('Expected a button interaction');
			}

			const potentialError = `Unknown customId: ${collected.customId}`;
			switch (collected.customId) {
				case 'ConfirmActionActive':
					await confirmedAction(followUp, collected); // Perform the confirmed action.
					break;
				case 'CancelActionActive':
					// Revert to original state
					await followUp.delete();
					// await interaction.update({
					// 	components: updatedComponents,
					// });
					break;
				default:
					throw new Error(potentialError);
			}
		} catch (error) {
			// This block handles the timeout case
			if (
				error.message.includes(
					'Collector received no interactions before ending with reason: time',
				)
			) {
				// If no interaction is collected in the specified time, revert to original state
				await followUp.delete();
			} else {
				throw error; // Re-throw the error if it's not a timeout
			}
		}
	} catch (error) {
		if (error instanceof DiscordAPIError && error.code === 10062) {
			// Handle specific "Unknown interaction" error
			// eslint-disable-next-line no-console
			console.error('Swallowed Unknown Interaction error');
			await followUp?.delete();
			// 	TODO: when we error, we need to reset the message or delete it
			//  currently, the follow up is not deleted
		} else if (error instanceof DiscordAPIError && error.code === 44060) {
			// Handle specific "interaction already acknowledged" error
			// eslint-disable-next-line no-console
			console.error('Swallowed Interaction already acknowledged error');
			await followUp?.delete();
		} else {
			// Handle other errors
			await gracefullyHandleError(error);
		}
	}
}