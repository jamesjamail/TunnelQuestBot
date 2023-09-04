import {
	InteractionCollector,
	ButtonInteraction,
	ComponentType,
	InteractionResponse,
} from 'discord.js';
import { ButtonInteractionTypes } from './buttonBuilder';
import { Watch } from '@prisma/client';
import * as handlers from './buttonInteractionHandlers/index';

export async function collectButtonInteractionAndReturnResponse(
	response: InteractionResponse,
	metadata: Watch,
) {
	const collector: InteractionCollector<ButtonInteraction> =
		response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 3_600_000,
		});

	collector.on('collect', async (interaction: ButtonInteraction) => {
		switch (interaction.customId) {
			case ButtonInteractionTypes[
				ButtonInteractionTypes.WatchSnoozeInactive
			]:
				await handlers.handleWatchSnoozeInactive(interaction, metadata);
				break;
			case ButtonInteractionTypes[
				ButtonInteractionTypes.WatchSnoozeActive
			]:
				await handlers.handleWatchSnoozeActive(interaction, metadata);
				break;
			case ButtonInteractionTypes[ButtonInteractionTypes.UnwatchInactive]:
				await handlers.handleUnwatchInactive(interaction, metadata);
				break;
			case ButtonInteractionTypes[ButtonInteractionTypes.UnwatchActive]:
				await handlers.handleUnwatchActive(interaction, metadata);
				break;
			case ButtonInteractionTypes[
				ButtonInteractionTypes.WatchRefreshInactive
			]:
				await handlers.handleWatchRefreshInactive(
					interaction,
					metadata,
				);
				break;
			case ButtonInteractionTypes[
				ButtonInteractionTypes.WatchRefreshActive
			]:
				//  watch refresh is not a toggle state like other button commands.
				//  we perform the same action regardless of active/inactive
				await handlers.handleWatchRefreshInactive(
					interaction,
					metadata,
				);
				break;
			default:
				break;
		}
	});

	return response;
}
