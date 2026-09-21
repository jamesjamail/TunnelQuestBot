import type { EmbedBuilder } from 'discord.js';
import type { Watch } from '../../prisma/client';
import {
	claimMarketplaceMatchNotification,
	getMarketplaceViewForWatch,
	getWatchIdsWithPendingMarketplaceMatches,
	matchNewWatchToMarketplace,
	releaseMarketplaceMatchNotificationClaim,
	sweepMarketplaceMatches,
	type MarketplaceCounterpart,
	type WatchWithUser,
} from '../../prisma/dbExecutors/marketplace';
import { marketplaceDigestBuilder } from '../content/messages/messageBuilder';
import { buildMarketplaceDigestMessage } from './marketplaceDigestMessage';
import { isSnoozed } from '../helpers/watches';
import { client } from '../..';
import { gracefullyHandleError, isClosedDmError } from '../helpers/errors';

// 	Snooze is checked here, when a DM is about to go out, rather than when a
// 	match is recorded: a snoozed user stays matched, listed and visible to
// 	others, and simply isn't messaged until the snooze lifts.
function canBeMessaged(watch: WatchWithUser): boolean {
	return (
		watch.active &&
		watch.isPublicallyTradeable &&
		!isSnoozed(watch.snoozedUntil) &&
		!isSnoozed(watch.user.snoozedUntil)
	);
}

// 	Each match keeps its own claim so a concurrent caller (the event-triggered
// 	check and the periodic sweep can race on the same row) can't tell the same
// 	side twice, and so we know exactly which counterparts this caller owns.
async function claimCounterparts(
	counterparts: MarketplaceCounterpart[],
): Promise<MarketplaceCounterpart[]> {
	const claimed: MarketplaceCounterpart[] = [];
	for (const counterpart of counterparts) {
		if (
			await claimMarketplaceMatchNotification(
				counterpart.matchId,
				counterpart.side,
			)
		) {
			claimed.push(counterpart);
		}
	}
	return claimed;
}

// 	One DM per watch, however many counterparts it gained since the last
// 	cycle. Rows past the digest's cap are claimed with the rest and stay
// 	reachable through /marketplace.
async function sendMarketplaceDigest(watchId: number): Promise<void> {
	// 	the match rows can be stale by up to one sweep interval - reading the
	// 	view fresh right before claiming means an ended, unlisted or snoozed
	// 	watch, or a since-blocked or hidden trader, doesn't still get a DM
	const view = await getMarketplaceViewForWatch(watchId);
	if (!view || !canBeMessaged(view.watch)) return;

	const claimed = await claimCounterparts(
		view.counterparts.filter((counterpart) => !counterpart.notified),
	);
	if (claimed.length === 0) return;

	try {
		await client.users.send(
			view.watch.discordUserId,
			buildMarketplaceDigestMessage(
				view.watch,
				claimed,
				'New traders matching your watch',
			),
		);
	} catch (error) {
		const context = {
			watchId,
			matchIds: claimed.map((counterpart) => counterpart.matchId),
		};
		// 	a closed DM is deliberately left claimed - retrying it every sweep
		// 	would never succeed
		if (!isClosedDmError(error)) {
			for (const counterpart of claimed) {
				// 	the row can be gone (watch unwatched mid-send), so a failed
				// 	release must not replace the send error we're here to report
				try {
					await releaseMarketplaceMatchNotificationClaim(
						counterpart.matchId,
						counterpart.side,
					);
				} catch (releaseError) {
					await gracefullyHandleError(
						releaseError,
						undefined,
						undefined,
						{ ...context, matchId: counterpart.matchId },
					);
				}
			}
		}
		await gracefullyHandleError(error, undefined, undefined, context);
	}
}

// 	Called right after a watch is upserted. Records the pairings created from
// 	this specific watch - the periodic sweep is what catches pairings formed by
// 	a change on the *other* side. Nothing is DMed: the caller is mid-reply to
// 	the person who made the watch, so what they matched goes in that reply,
// 	and the counterparts hear about it in their next digest.
export async function checkForMarketplaceMatches(
	watch: Watch,
): Promise<EmbedBuilder | undefined> {
	await matchNewWatchToMarketplace(watch);

	const view = await getMarketplaceViewForWatch(watch.id);
	if (!view || view.counterparts.length === 0) return undefined;

	// 	they are about to be shown these, so the digest must not repeat them
	await claimCounterparts(
		view.counterparts.filter((counterpart) => !counterpart.notified),
	);

	return marketplaceDigestBuilder(
		view.watch,
		view.counterparts,
		'Traders matching your watch',
	);
}

export async function runMarketplaceMatchingSweep(): Promise<void> {
	await sweepMarketplaceMatches();

	// 	each watch claims its own rows, so one failure (a closed DM, a
	// 	transient send error) must not stop the rest
	const results = await Promise.allSettled(
		(await getWatchIdsWithPendingMarketplaceMatches()).map(
			sendMarketplaceDigest,
		),
	);

	for (const result of results) {
		if (result.status === 'rejected') {
			await gracefullyHandleError(result.reason);
		}
	}
}
