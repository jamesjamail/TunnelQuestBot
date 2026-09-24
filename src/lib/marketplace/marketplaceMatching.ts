import type { EmbedBuilder } from 'discord.js';
import type { Watch } from '../../prisma/client';
import {
	claimMarketplaceMatchNotification,
	filterOutRecentlyNotified,
	getMarketplaceViewForWatch,
	getWatchIdsWithPendingMarketplaceMatches,
	matchNewWatchToMarketplace,
	recordMarketplaceNotifications,
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
// 	reachable through /marketplace. A counterpart recently notified about
// 	this same watch's owner - even under a since-deleted match, see
// 	filterOutRecentlyNotified - is left unclaimed rather than sent again, so
// 	it is picked up automatically once the throttle window passes.
async function sendMarketplaceDigest(watchId: number): Promise<void> {
	// 	the match rows can be stale by up to one sweep interval - reading the
	// 	view fresh right before claiming means an ended, unlisted or snoozed
	// 	watch, or a since-blocked or hidden trader, doesn't still get a DM
	const view = await getMarketplaceViewForWatch(watchId);
	if (!view || !canBeMessaged(view.watch)) return;

	const eligible = await filterOutRecentlyNotified(
		view.watch.discordUserId,
		view.watch.itemName,
		view.watch.server,
		view.counterparts.filter((counterpart) => !counterpart.notified),
	);
	const claimed = await claimCounterparts(eligible);
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
		// 	the send already succeeded, so a failure here must not be treated
		// 	as a send failure (which would release claims and risk a duplicate
		// 	DM next sweep) - it only weakens the throttle for this one cycle
		try {
			await recordMarketplaceNotifications(
				view.watch.discordUserId,
				view.watch.itemName,
				view.watch.server,
				claimed,
			);
		} catch (recordError) {
			await gracefullyHandleError(recordError, undefined, undefined, {
				watchId,
				matchIds: claimed.map((counterpart) => counterpart.matchId),
				phase: 'marketplaceNotificationHistory',
			});
		}
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

export type MarketplacePreview = {
	embed: EmbedBuilder;
	// 	the counterparts this preview is about to show and must therefore claim
	// 	- kept separate from the embed so the caller can commit the claim only
	// 	once the embed has actually been delivered, see commitMarketplacePreview
	claimable: MarketplaceCounterpart[];
};

// 	Called right after a watch is upserted. Records the pairings created from
// 	this specific watch - the periodic sweep is what catches pairings formed by
// 	a change on the *other* side. Nothing is DMed: the caller is mid-reply to
// 	the person who made the watch, so what they matched goes in that reply,
// 	and the counterparts hear about it in their next digest.
//
// 	Always reflects the watch's current marketplace state - listed, unlisted,
// 	or listed with no matches yet - rather than returning undefined whenever
// 	there happens to be nothing to show, so the confirmation this feeds never
// 	silently omits it. The embed is built, and can throw, before anything is
// 	claimed; see commitMarketplacePreview for why that order matters.
export async function buildMarketplacePreview(
	watch: Watch,
): Promise<MarketplacePreview | undefined> {
	await matchNewWatchToMarketplace(watch);

	const view = await getMarketplaceViewForWatch(watch.id);
	if (!view) return undefined;

	const embed = marketplaceDigestBuilder(
		view.watch,
		view.counterparts,
		'Traders matching your watch',
	);
	return {
		embed,
		claimable: view.counterparts.filter(
			(counterpart) => !counterpart.notified,
		),
	};
}

// 	Claims a preview's counterparts so the next digest does not repeat them.
// 	Call this only after the caller has successfully delivered the preview
// 	embed: claiming nothing until delivery is confirmed means a failure to
// 	build or send it never strands a claim behind something the recipient was
// 	never actually shown, without needing to release anything afterward. A
// 	counterpart already claimed by a concurrent sweep is simply skipped; if
// 	claiming one throws, whatever this call already claimed is released
// 	rather than left committed for a preview whose delivery is now in doubt.
export async function commitMarketplacePreview(
	preview: MarketplacePreview,
): Promise<void> {
	const claimed: MarketplaceCounterpart[] = [];
	try {
		for (const counterpart of preview.claimable) {
			if (
				await claimMarketplaceMatchNotification(
					counterpart.matchId,
					counterpart.side,
				)
			) {
				claimed.push(counterpart);
			}
		}
	} catch (error) {
		await Promise.allSettled(
			claimed.map((counterpart) =>
				releaseMarketplaceMatchNotificationClaim(
					counterpart.matchId,
					counterpart.side,
				),
			),
		);
		throw error;
	}
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
