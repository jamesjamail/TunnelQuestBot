import {
	WatchType,
	type MarketplaceMatch,
	type Server,
	type User,
	type Watch,
} from '../client';
import { prisma } from '../init';
import { isSnoozed } from '../../lib/helpers/watches';

export type WatchWithUser = Watch & { user: User };

export type MarketplaceMatchWithWatches = MarketplaceMatch & {
	wtbWatch: WatchWithUser;
	wtsWatch: WatchWithUser;
};

const matchWithWatchesInclude = {
	wtbWatch: { include: { user: true } },
	wtsWatch: { include: { user: true } },
} as const;

function counterpartType(watchType: WatchType): WatchType {
	return watchType === WatchType.WTB ? WatchType.WTS : WatchType.WTB;
}

// 	A WTB watch's priceRequirement is the seller's floor (the least they'll take);
// 	a WTS watch's priceRequirement is the buyer's ceiling (the most they'll pay).
// 	A deal has room to happen when the floor is at or below the ceiling. Either
// 	side leaving price unset is treated as "negotiable" rather than excluded.
export function isPriceCompatible(wtbWatch: Watch, wtsWatch: Watch): boolean {
	if (
		wtbWatch.priceRequirement == null ||
		wtsWatch.priceRequirement == null
	) {
		return true;
	}
	return wtbWatch.priceRequirement <= wtsWatch.priceRequirement;
}

// 	Watches opted out, snoozed (at the watch or the owner level), or inactive
// 	are excluded directly in the query so callers never have to re-derive
// 	eligibility from a raw row.
async function findEligibleWatchesByType(
	watchType: WatchType,
	filter?: { server: Server; itemName: string },
): Promise<WatchWithUser[]> {
	const now = new Date();
	return prisma.watch.findMany({
		where: {
			watchType,
			active: true,
			isPublicallyTradeable: true,
			OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
			user: {
				OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
			},
			...filter,
		},
		include: { user: true },
	});
}

function isPrismaUniqueConstraintViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: string }).code === 'P2002'
	);
}

// 	The unique constraint on [wtbWatchId, wtsWatchId] is the source of truth for
// 	"already matched" - relying on it (rather than a pre-check query) means a
// 	concurrent upsert and sweep can't both create the same pairing.
async function recordMarketplaceMatchIfNew(
	wtbWatch: Watch,
	wtsWatch: Watch,
): Promise<MarketplaceMatchWithWatches | null> {
	try {
		return await prisma.marketplaceMatch.create({
			data: {
				wtbWatchId: wtbWatch.id,
				wtsWatchId: wtsWatch.id,
				server: wtbWatch.server,
				itemName: wtbWatch.itemName,
			},
			include: matchWithWatchesInclude,
		});
	} catch (error) {
		if (isPrismaUniqueConstraintViolation(error)) {
			return null;
		}
		throw error;
	}
}

async function pairAndRecord(
	wtbWatches: WatchWithUser[],
	wtsWatches: WatchWithUser[],
): Promise<MarketplaceMatchWithWatches[]> {
	const created: MarketplaceMatchWithWatches[] = [];

	for (const wtbWatch of wtbWatches) {
		for (const wtsWatch of wtsWatches) {
			if (wtbWatch.discordUserId === wtsWatch.discordUserId) continue;
			if (!isPriceCompatible(wtbWatch, wtsWatch)) continue;

			const match = await recordMarketplaceMatchIfNew(wtbWatch, wtsWatch);
			if (match) created.push(match);
		}
	}

	return created;
}

// 	Called right after a watch is upserted so a user opting in (or creating a
// 	fresh watch) sees a standing match immediately, rather than waiting for the
// 	next sweep.
export async function matchNewWatchToMarketplace(
	watch: Watch,
): Promise<MarketplaceMatchWithWatches[]> {
	if (!watch.isPublicallyTradeable || !watch.active) return [];
	if (isSnoozed(watch.snoozedUntil)) return [];

	const user = await prisma.user.findUnique({
		where: { discordUserId: watch.discordUserId },
	});
	if (!user || isSnoozed(user.snoozedUntil)) return [];

	const watchWithUser: WatchWithUser = { ...watch, user };
	const candidates = await findEligibleWatchesByType(
		counterpartType(watch.watchType),
		{ server: watch.server, itemName: watch.itemName },
	);

	return watch.watchType === WatchType.WTB
		? pairAndRecord([watchWithUser], candidates)
		: pairAndRecord(candidates, [watchWithUser]);
}

// 	Safety net for pairings that can only be discovered after the fact - e.g.
// 	one side opts in, unsnoozes, or edits a price requirement well after the
// 	other side's watch was already created.
export async function sweepMarketplaceMatches(): Promise<
	MarketplaceMatchWithWatches[]
> {
	const [wtbWatches, wtsWatches] = await Promise.all([
		findEligibleWatchesByType(WatchType.WTB),
		findEligibleWatchesByType(WatchType.WTS),
	]);

	const wtsByServerAndItem = new Map<string, WatchWithUser[]>();
	for (const watch of wtsWatches) {
		const key = `${watch.server}:${watch.itemName}`;
		const bucket = wtsByServerAndItem.get(key);
		if (bucket) {
			bucket.push(watch);
		} else {
			wtsByServerAndItem.set(key, [watch]);
		}
	}

	const created: MarketplaceMatchWithWatches[] = [];
	for (const wtbWatch of wtbWatches) {
		const key = `${wtbWatch.server}:${wtbWatch.itemName}`;
		const candidates = wtsByServerAndItem.get(key);
		if (!candidates) continue;

		created.push(...(await pairAndRecord([wtbWatch], candidates)));
	}

	return created;
}

export async function getUnnotifiedMarketplaceMatches(): Promise<
	MarketplaceMatchWithWatches[]
> {
	return prisma.marketplaceMatch.findMany({
		where: {
			OR: [{ wtbNotifiedAt: null }, { wtsNotifiedAt: null }],
		},
		include: matchWithWatchesInclude,
	});
}

// 	Matches can sit unnotified for up to one sweep interval, so the watch (or
// 	its owner) may have been ended or snoozed after the match row was fetched
// 	but before the DM goes out. Re-checked with a fresh read right before send,
// 	mirroring shouldUserBeNotified's eligibility checks for the auction path.
export async function isWatchStillEligible(watchId: number): Promise<boolean> {
	const watch = await prisma.watch.findUnique({
		where: { id: watchId },
		include: { user: true },
	});
	if (!watch) return false;
	if (!watch.active) return false;
	if (isSnoozed(watch.snoozedUntil)) return false;
	if (isSnoozed(watch.user.snoozedUntil)) return false;
	return true;
}

export type MarketplaceMatchSide = 'wtb' | 'wts';

// 	Atomically claims one side's notification slot, mirroring the redis SET-NX
// 	debounce claim in watchNotification.ts: the update only succeeds while the
// 	field is still null, so a concurrent caller (the event-triggered check and
// 	the periodic sweep can race on the same row) can't send the same side's DM
// 	twice.
export async function claimMarketplaceMatchNotification(
	matchId: number,
	side: MarketplaceMatchSide,
): Promise<boolean> {
	const result = await prisma.marketplaceMatch.updateMany({
		where:
			side === 'wtb'
				? { id: matchId, wtbNotifiedAt: null }
				: { id: matchId, wtsNotifiedAt: null },
		data:
			side === 'wtb'
				? { wtbNotifiedAt: new Date() }
				: { wtsNotifiedAt: new Date() },
	});
	return result.count === 1;
}

// 	Releases a claim after a failed send (other than a closed DM, which is
// 	deliberately left claimed - see notifyMarketplaceMatches) so the next sweep
// 	retries it instead of the match being silently stuck as "notified".
export async function releaseMarketplaceMatchNotificationClaim(
	matchId: number,
	side: MarketplaceMatchSide,
): Promise<void> {
	await prisma.marketplaceMatch.update({
		where: { id: matchId },
		data:
			side === 'wtb' ? { wtbNotifiedAt: null } : { wtsNotifiedAt: null },
	});
}
