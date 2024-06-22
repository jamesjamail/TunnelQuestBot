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
} from '../../prisma/dbExecutors/watch';
import { isSnoozed } from '../helpers/watches';
import crypto from 'crypto';
import { redis } from '../../redis/init';
import { gracefullyHandleError } from '../helpers/errors';

export function generateDebounceKey(
	watchId: number,
	player: string,
	price: number | undefined,
) {
	const uniqueString = `${watchId}:${player.toUpperCase()}:${price}`;
	const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');
	const prefix = 'watchNotification:';
	return prefix + hash;
}

export async function shouldUserBeNotified(
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

	// Check if notification was already sent within the last 15 minutes
	const debounceKey = generateDebounceKey(watch.id, player, price);
	const alreadyNotified = await redis.exists(debounceKey);

	if (alreadyNotified) {
		return false;
	}

	// ensure seller is not globally blocked by user
	blockedPlayers.forEach((blockedPlayer) => {
		if (blockedPlayer.player === player.toUpperCase()) {
			return false;
		}
	});

	if (
		blockedPlayers.some(
			(blockedPlayer) => blockedPlayer.player === player.toUpperCase(),
		)
	) {
		return false;
	}

	// ensure seller is not blocked by watch
	if (
		watch.blockedWatches.some(
			(blockedWatch) => blockedWatch.player === player.toUpperCase(),
		)
	) {
		return false;
	}

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

	if (!(await shouldUserBeNotified(data, blocks, player, price))) {
		return;
	}

	const embeds = [];
	try {
		embeds.push(
			await watchNotificationBuilder(data, player, price, auctionMessage),
		);
	} catch (error) {
		await gracefullyHandleError(error, undefined, undefined, data);
		return;
	}
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

	// Set the debounce key in Redis with a 15-minute expiration
	const debounceKey = generateDebounceKey(watchId, player, price);
	await redis.set(debounceKey, 'notified', 'EX', 15 * 60);
}

export async function triggerFoundWatchedItems(
	watchIds: number[],
	player: string,
	price: number | undefined,
	auctionMessage: string,
) {
	const promises = watchIds.map(async (watchId) => {
		await triggerFoundWatchedItem(watchId, player, price, auctionMessage);
	});
	await Promise.all(promises);
}
