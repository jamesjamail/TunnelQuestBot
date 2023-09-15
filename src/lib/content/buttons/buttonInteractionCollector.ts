import {
	InteractionCollector,
	ButtonInteraction,
	ComponentType,
	InteractionResponse,
} from 'discord.js';
import { ButtonInteractionTypes } from './buttonBuilder';
import * as handlers from './buttonInteractionHandlers/index';

export async function collectButtonInteractionAndReturnResponse<T>(
	response: InteractionResponse,
	metadata: T,
) {
	const collector: InteractionCollector<ButtonInteraction> =
		response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 3_600_000,
		});

	collector.on('collect', async (interaction: ButtonInteraction) => {
		// map interaction types to specific handler functions.
		const handlerMapping: {
			[key: string]: (
				interaction: ButtonInteraction,
				metadata: T,
			) => Promise<void>;
		} = {
			[ButtonInteractionTypes.WatchSnoozeInactive]:
				handlers.handleWatchSnoozeInactive,
			[ButtonInteractionTypes.WatchSnoozeActive]:
				handlers.handleWatchSnoozeActive,
			[ButtonInteractionTypes.UnwatchActive]:
				handlers.handleUnwatchActive,
			[ButtonInteractionTypes.UnwatchInactive]:
				handlers.handleUnwatchInactive,
			[ButtonInteractionTypes.WatchRefreshInactive]:
				//	since refresh button does not have a toggle state, we can use
				//  the same handler for both states.
				handlers.handleWatchRefreshInactive,
			[ButtonInteractionTypes.WatchRefreshActive]:
				handlers.handleWatchRefreshInactive,
			[ButtonInteractionTypes.GlobalRefreshInactive]:
				handlers.handleGlobalRefreshInactive,
			[ButtonInteractionTypes.GlobalRefreshActive]:
				//	since refresh button does not have a toggle state, we can use
				//  the same handler for both states.
				handlers.handleGlobalRefreshInactive,
			[ButtonInteractionTypes.UserSnoozeInactive]:
				handlers.handleUserSnoozeInactive,
			[ButtonInteractionTypes.UserSnoozeActive]:
				handlers.handleUserSnoozeActive,
			// TODO: add other mappings
		};

		const handler =
			handlerMapping[
				ButtonInteractionTypes[
					interaction.customId as keyof typeof ButtonInteractionTypes
				]
			];
		if (handler) {
			await handler(interaction, metadata);
		}
	});

	return response;
}
