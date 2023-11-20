import { BlockedPlayer, Watch, WatchType } from '@prisma/client';
import { watchNotificationBuilder } from '../content/messages/messageBuilder';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../content/buttons/buttonRowBuilder';
import { InteractionResponse } from 'discord.js';
import { collectButtonInteractionAndReturnResponse } from '../content/buttons/buttonInteractionCollector';
import { client } from '../..';
import { getPlayerBlocks } from '../../prisma/dbExecutors/block';
import {
	WatchWithUserAndBlockedWatches,
	getWatchByWatchIdForWatchNotification,
	updateWatchLastNotifiedTimestamp,
} from '../../prisma/dbExecutors/watch';
import {
	isSnoozed,
	lastAlertedMoreThanFifteenMinutesAgo,
} from '../helpers/watches';

export function shouldUserByNotified(
	watch: WatchWithUserAndBlockedWatches,
	blockedPlayers: BlockedPlayer[],
	player: string,
	price: number | undefined,
) {
	//  ensure the watch is not currently snoozed
	if (isSnoozed(watch.snoozedUntil)) {
		return false;
	}
	// ensure watch is active
	if (!watch.active) {
		return false;
	}
	// ensure the user is not globally snoozed
	if (isSnoozed(watch.user.snoozedUntil)) {
		return false;
	}
	// ensure 15 minutes have elpased since the last notified timestamp on the watch
	if (!lastAlertedMoreThanFifteenMinutesAgo(watch.lastAlertedTimestamp)) {
		return false;
	}

	// ensure seller is not globally blocked by user
	blockedPlayers.forEach((blockedPlayer) => {
		if (blockedPlayer.player === player.toUpperCase()) {
			return false;
		}
	});

	// ensure seller is not blocked by watch
	watch.blockedWatches.forEach((blockedWatch) => {
		if (blockedWatch.player === player.toUpperCase()) {
			return false;
		}
	});

	// if there is price criteria, ensure it is met
	if (watch.priceRequirement) {
		// if price criteria set, a price must be parsed to trigger watch notification
		if (!price) {
			return false;
		}
		// if watching for WTS, auctioned price must be lower than the price criteria
		if (watch.watchType === WatchType.WTS) {
			if (watch.priceRequirement > price) {
				return false;
			}
			// if watching for WTB, auctioned price must be higher than the price criteria
		} else {
			if (watch.priceRequirement > price) {
				return false;
			}
		}
	}

	// return true if all other criteria met
	return true;
}

export type WatchNotificationMetadata = Watch & {
	player: string;
	price: number | undefined;
	auctionMessage: string;
};

export async function triggerFoundWatchedItem(
	watchId: number,
	player: string,
	price: number | undefined,
	auctionMessage: string,
) {
	//  get the watch and user from the db, as well as blocks by user and watch
	const data = await getWatchByWatchIdForWatchNotification(watchId);
	const blocks = await getPlayerBlocks(data.user.discordUserId);

	if (!shouldUserByNotified(data, blocks, player, price)) {
		return;
	}

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];
	const components = buttonRowBuilder(MessageTypes.watchNotification);

	const message = await client.users.send(data.discordUserId, {
		embeds,
		components,
	});

	// player is sourced from the function args, not the db
	const metadata = {
		...data,
		player,
		price,
		auctionMessage,
	} as WatchNotificationMetadata;

	await collectButtonInteractionAndReturnResponse(
		message as unknown as InteractionResponse<boolean>,
		metadata,
	);

	await updateWatchLastNotifiedTimestamp(watchId);
}

export async function triggerFoundWatchedItems(
	watchIds: number[],
	player: string,
	price: number | undefined,
	auctionMessage: string,
) {
	watchIds.forEach(async (watchId) => {
		await triggerFoundWatchedItem(watchId, player, price, auctionMessage);
	});
}
