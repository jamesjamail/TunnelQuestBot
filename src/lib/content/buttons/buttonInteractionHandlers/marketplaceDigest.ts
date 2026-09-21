import type { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import type { Watch } from '../../../../prisma/client';
import {
	extendWatch,
	setWatchActiveByWatchId,
	setWatchListed,
	snoozeWatch,
	unsnoozeWatch,
	unwatch,
} from '../../../../prisma/dbExecutors/watch';
import { getMarketplaceViewForWatch } from '../../../../prisma/dbExecutors/marketplace';
import { buildMarketplaceDigestMessage } from '../../../marketplace/marketplaceDigestMessage';
import { debug } from '../../../helpers/logger';

// 	Every button on a digest changes the watch and then re-renders from what is
// 	now stored, so the message can only ever show the watch's real state.
async function applyAndRerender(
	interaction: ButtonInteraction,
	watch: Watch,
	apply: () => Promise<unknown>,
	content: string,
) {
	await apply();

	const view = await getMarketplaceViewForWatch(watch.id);
	if (!view) {
		await interaction.update({
			content: messageCopy.thisItemNoLongerExists,
			embeds: [],
			components: [],
		});
		return;
	}

	await interaction.update({
		content,
		...buildMarketplaceDigestMessage(
			view.watch,
			view.counterparts,
			'Traders matching your watch',
		),
	});
	debug(content);
}

export function handleMarketplaceSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => snoozeWatch(watch),
		messageCopy.yourWatchHasBeenSnoozed(),
	);
}

export function handleMarketplaceSnoozeActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => unsnoozeWatch(watch),
		messageCopy.yourWatchHasBeenUnsnoozed,
	);
}

export function handleMarketplaceUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => unwatch(watch),
		messageCopy.yourWatchHasBeenUnwatched(watch.itemName, watch.server),
	);
}

export function handleMarketplaceUnwatchActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => setWatchActiveByWatchId(watch.id),
		messageCopy.yourWatchHasBeenRestored(watch.itemName, watch.server),
	);
}

export function handleMarketplaceRefresh<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => extendWatch(watch),
		messageCopy.yourWatchHasBeenExtended,
	);
}

// 	the button shows the state the watch is in, so clicking the inactive one
// 	lists the watch and clicking the active one unlists it
export function handleMarketplaceListedInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => setWatchListed(watch.id, true),
		messageCopy.yourWatchIsNowListed,
	);
}

export function handleMarketplaceListedActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const watch = metadata as Watch;
	return applyAndRerender(
		interaction,
		watch,
		() => setWatchListed(watch.id, false),
		messageCopy.yourWatchIsNoLongerListed,
	);
}
