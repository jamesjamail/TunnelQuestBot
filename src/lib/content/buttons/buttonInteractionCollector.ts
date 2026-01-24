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
		});

	//  map interaction types to specific handler functions.
	collector.on('collect', async (interaction: ButtonInteraction) => {
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
			[ButtonInteractionTypes.UnwatchInactive]:
				handlers.handleUnwatchInactive,
			[ButtonInteractionTypes.UnwatchActive]:
				handlers.handleUnwatchActive,
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
			[ButtonInteractionTypes.GlobalUnblockInactive]:
				handlers.handleGlobalUnblockInactive,
			[ButtonInteractionTypes.GlobalUnblockActive]:
				handlers.handleGlobalUnblockActive,
			[ButtonInteractionTypes.UnlinkCharacterInactive]:
				handlers.handleUnlinkCharacterInactive,
			[ButtonInteractionTypes.UnlinkCharacterActive]:
				handlers.handleUnlinkCharacterActive,
			[ButtonInteractionTypes.WatchBlockInactive]:
				handlers.handleWatchBlockInactive,
			[ButtonInteractionTypes.WatchBlockActive]:
				handlers.handleWatchBlockActive,
			[ButtonInteractionTypes.WatchNotificationSnoozeInactive]:
				handlers.handleWatchNotificationSnoozeInactive,
			[ButtonInteractionTypes.WatchNotificationSnoozeActive]:
				handlers.handleWatchNotificationSnoozeActive,
			[ButtonInteractionTypes.WatchNotificationUnwatchInactive]:
				handlers.handleWatchNotificationUnwatchInactive,
			[ButtonInteractionTypes.WatchNotificationUnwatchActive]:
				handlers.handleWatchNotificationUnwatchActive,
			[ButtonInteractionTypes.WatchNotificationWatchRefreshInactive]:
				handlers.handleWatchNotificationRefreshInactive,
			[ButtonInteractionTypes.WatchNotificationWatchRefreshActive]:
				handlers.handleWatchNotificationRefreshInactive,
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
