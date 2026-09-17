import type { Watch } from '../../prisma/client';
import {
	claimMarketplaceMatchNotification,
	getUnnotifiedMarketplaceMatches,
	isWatchStillEligible,
	matchNewWatchToMarketplace,
	releaseMarketplaceMatchNotificationClaim,
	sweepMarketplaceMatches,
	type MarketplaceMatchSide,
	type MarketplaceMatchWithWatches,
	type WatchWithUser,
} from '../../prisma/dbExecutors/marketplace';
import { marketplaceMatchBuilder } from '../content/messages/messageBuilder';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../content/buttons/buttonRowBuilder';
import { client } from '../..';
import { gracefullyHandleError, isClosedDmError } from '../helpers/errors';

function sideOf(
	match: MarketplaceMatchWithWatches,
	side: MarketplaceMatchSide,
): { mine: WatchWithUser; theirs: WatchWithUser } {
	return side === 'wtb'
		? { mine: match.wtbWatch, theirs: match.wtsWatch }
		: { mine: match.wtsWatch, theirs: match.wtbWatch };
}

async function notifyMarketplaceMatchSide(
	match: MarketplaceMatchWithWatches,
	side: MarketplaceMatchSide,
): Promise<void> {
	const alreadyNotified =
		side === 'wtb' ? match.wtbNotifiedAt : match.wtsNotifiedAt;
	if (alreadyNotified) return;

	const { mine } = sideOf(match, side);

	// 	the match row can be stale by up to one sweep interval - re-check the
	// 	watch and its owner right before claiming so an ended or snoozed watch
	// 	doesn't still get a DM
	if (!(await isWatchStillEligible(mine.id))) return;

	const claimed = await claimMarketplaceMatchNotification(match.id, side);
	if (!claimed) return;

	const { theirs } = sideOf(match, side);

	try {
		const embeds = [marketplaceMatchBuilder(mine, theirs)];
		const components = buttonRowBuilder(
			MessageTypes.watch,
			[false, false, false],
			String(mine.id),
		);
		await client.users.send(mine.discordUserId, { embeds, components });
	} catch (error) {
		if (!isClosedDmError(error)) {
			await releaseMarketplaceMatchNotificationClaim(match.id, side);
		}
		await gracefullyHandleError(error, undefined, undefined, {
			matchId: match.id,
			side,
			watchId: mine.id,
		});
	}
}

export async function notifyMarketplaceMatches(
	matches: MarketplaceMatchWithWatches[],
): Promise<void> {
	// 	each side belongs to a different user and claims its own slot, so one
	// 	failure (a closed DM, a transient send error) must not stop the rest
	const results = await Promise.allSettled(
		matches.flatMap((match) => [
			notifyMarketplaceMatchSide(match, 'wtb'),
			notifyMarketplaceMatchSide(match, 'wts'),
		]),
	);

	for (const result of results) {
		if (result.status === 'rejected') {
			await gracefullyHandleError(result.reason);
		}
	}
}

// 	Called right after a watch is upserted. Only notifies the pairings created
// 	from this specific watch - the periodic sweep is what catches pairings
// 	formed by a change on the *other* side, and anything left over from a
// 	failed send.
export async function checkForMarketplaceMatches(watch: Watch): Promise<void> {
	const matches = await matchNewWatchToMarketplace(watch);
	await notifyMarketplaceMatches(matches);
}

export async function runMarketplaceMatchingSweep(): Promise<void> {
	await sweepMarketplaceMatches();
	const pending = await getUnnotifiedMarketplaceMatches();
	await notifyMarketplaceMatches(pending);
}
