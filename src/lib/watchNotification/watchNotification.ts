import { type BlockedPlayer, type Watch, WatchType } from '../../prisma/client';
import { watchNotificationBuilder } from '../content/messages/messageBuilder';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../content/buttons/buttonRowBuilder';
import { client } from '../..';
import { getPlayerBlocks } from '../../prisma/dbExecutors/block';
import {
	type WatchWithUserAndBlockedWatches,
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

	// ensure seller is not globally blocked by user
	if (
		blockedPlayers.some(
			(blockedPlayer) =>
				blockedPlayer.player === player.toUpperCase() &&
				blockedPlayer.server === watch.server,
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
		// if watching for WTS, auctioned price must be at or below the price criteria (a budget cap)
		if (watch.watchType === WatchType.WTS) {
			if (price > watch.priceRequirement) {
				return false;
			}
			// if watching for WTB, auctioned price must be at or above the price criteria (a minimum offer)
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

function isClosedDmError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: number }).code === 50007
	);
}

async function releaseDebounceClaim(
	debounceKey: string,
	context: object,
): Promise<void> {
	try {
		await redis.del(debounceKey);
	} catch (error) {
		await gracefullyHandleError(error, undefined, undefined, context);
	}
}

export async function triggerFoundWatchedItem(
	watchId: number,
	player: string,
	price: number | undefined,
	auctionMessage: string,
) {
	//  get the watch and user from the db, as well as blocks by user and watch
	const data = await getWatchByWatchIdForWatchNotification(watchId);

	// 	the in-memory watch index refreshes on an interval, so it can still name a
	// 	watch that expired since the last refresh - nothing to notify about
	if (!data) {
		return;
	}

	const blocks = await getPlayerBlocks(data.user.discordUserId);

	if (!(await shouldUserBeNotified(data, blocks, player, price))) {
		return;
	}

	// Atomically claim the debounce key BEFORE doing any work. SET NX returns
	// null when another concurrent trigger already claimed it. The key is
	// claimed even if the send later fails, deliberately: a user with closed
	// DMs must not produce an error for every matching auction line.
	const debounceKey = generateDebounceKey(watchId, player, price);
	const claimed = await redis.set(
		debounceKey,
		'notified',
		'EX',
		15 * 60,
		'NX',
	);
	if (!claimed) {
		return;
	}

	const embeds = [];
	try {
		embeds.push(
			await watchNotificationBuilder(data, player, price, auctionMessage),
		);
	} catch (error) {
		await releaseDebounceClaim(debounceKey, data);
		await gracefullyHandleError(error, undefined, undefined, data);
		return;
	}
	const components = buttonRowBuilder(
		MessageTypes.watchNotification,
		[false, false, false, false],
		`${data.id}:${player}`,
	);

	try {
		await client.users.send(data.discordUserId, {
			embeds,
			components,
		});
	} catch (error) {
		if (!isClosedDmError(error)) {
			await releaseDebounceClaim(debounceKey, data);
		}
		await gracefullyHandleError(error, undefined, undefined, data);
	}
}

export async function triggerFoundWatchedItems(
	watchIds: number[],
	player: string,
	price: number | undefined,
	auctionMessage: string,
) {
	// 	each watch belongs to a different user, so one failure must not stop the
	// 	rest from being notified or bubble up and kill the log parser
	const results = await Promise.allSettled(
		watchIds.map((watchId) =>
			triggerFoundWatchedItem(watchId, player, price, auctionMessage),
		),
	);

	for (const result of results) {
		if (result.status === 'rejected') {
			await gracefullyHandleError(result.reason, undefined, undefined, {
				player,
				price,
				auctionMessage,
			});
		}
	}
}
