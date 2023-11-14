import {
	ButtonInteraction,
	CacheType,
	ChannelSelectMenuInteraction,
	Interaction,
	MentionableSelectMenuInteraction,
	Message,
	MessageComponentInteraction,
	RoleSelectMenuInteraction,
	StringSelectMenuInteraction,
	UserSelectMenuInteraction,
} from 'discord.js';
import {
	buttonBuilder,
	ButtonInteractionTypes,
} from '../content/buttons/buttonBuilder';
import {
	MessageTypes,
	buttonRowBuilder,
} from '../content/buttons/buttonRowBuilder';

export async function deleteResponseIfNotModified(
	interaction: ButtonInteraction,
	duration: number,
) {
	setTimeout(async () => {
		try {
			// Fetch the current reply to the interaction.
			const message = (await interaction.fetchReply()) as Message;

			// If the content, components, and embeds are the same, consider it as not modified.
			if (message?.interaction?.id === interaction.id) {
				// Check if the message is unchanged and if so, delete it.
				await interaction.deleteReply();
			}
		} catch (error) {
			// This will also catch the error if there is no reply to fetch, meaning it has already been deleted.
			// not sure we should throw an error - let's log for now
			// eslint-disable-next-line no-console
			console.error('Error in deleting the interaction response:', error);
		}
	}, duration);
}

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
		throw new Error('initial interaction is a button');
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
	const ButtonRowWithActiveButton = buttonRowBuilder(commandType);
	await interaction.editReply({ components: ButtonRowWithActiveButton });

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
		if (
			error instanceof Error && // TypeScript way to ensure `error` has `message` property.
			!error.message.includes(
				'Collector received no interactions before ending with reason: time',
			)
		) {
			// eslint-disable-next-line no-console
			console.error('Error in collecting Interaction:', error);
		}
		// Revert to original state
		await followUp.delete();
		await interaction.editReply({
			components: updatedComponents,
		});
	}
}
