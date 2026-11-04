import {
	WatchType,
	type MarketplaceMatch,
	type Server,
	type User,
	type Watch,
} from '../client';
import { prisma } from '../init';

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

// 	Only watches that are marketplace-visible and active are matched. Snooze is
// 	deliberately not filtered here: a snoozed user stays listed and contactable,
// 	so their matches are recorded and only their DMs are held back (see
// 	getMarketplaceViewForWatch and the digest send).
async function findEligibleWatchesByType(
	watchType: WatchType,
	filter?: { server: Server; itemName: string },
): Promise<WatchWithUser[]> {
	return prisma.watch.findMany({
		where: {
			watchType,
			active: true,
			isPublicallyTradeable: true,
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

// 	The unique constraint on [wtbWatchId, wtsWatchId] remains the ultimate
// 	source of truth for "already matched" - a concurrent upsert and sweep can
// 	still race here, and this catch is what keeps that race from erroring.
// 	filterOutExistingMatches below is what keeps the *common* case (a pair
// 	that matched in a previous sweep) from ever reaching this insert attempt.
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

type WatchPair = { wtbWatch: WatchWithUser; wtsWatch: WatchWithUser };

function buildCandidatePairs(
	wtbWatches: WatchWithUser[],
	wtsWatches: WatchWithUser[],
): WatchPair[] {
	const pairs: WatchPair[] = [];
	for (const wtbWatch of wtbWatches) {
		for (const wtsWatch of wtsWatches) {
			if (wtbWatch.discordUserId === wtsWatch.discordUserId) continue;
			if (!isPriceCompatible(wtbWatch, wtsWatch)) continue;
			pairs.push({ wtbWatch, wtsWatch });
		}
	}
	return pairs;
}

// 	A block is mutual for matching: if either trader blocked the other, the
// 	pair is dropped. Pairing puts each side's handle in the other's DMs, so a
// 	one-directional block would still leave the blocked party seeing the
// 	blocker and free to contact them directly.
async function filterOutBlockedPairs(pairs: WatchPair[]): Promise<WatchPair[]> {
	if (pairs.length === 0) return [];

	const userIds = [
		...new Set(
			pairs.flatMap((pair) => [
				pair.wtbWatch.discordUserId,
				pair.wtsWatch.discordUserId,
			]),
		),
	];

	const blocks = await prisma.blockedTrader.findMany({
		where: {
			discordUserId: { in: userIds },
			blockedDiscordUserId: { in: userIds },
		},
		select: { discordUserId: true, blockedDiscordUserId: true },
	});
	if (blocks.length === 0) return pairs;

	const blockedKeys = new Set(
		blocks.map(
			(block) => `${block.discordUserId}:${block.blockedDiscordUserId}`,
		),
	);

	return pairs.filter(({ wtbWatch, wtsWatch }) => {
		const wtb = wtbWatch.discordUserId;
		const wts = wtsWatch.discordUserId;
		return (
			!blockedKeys.has(`${wtb}:${wts}`) &&
			!blockedKeys.has(`${wts}:${wtb}`)
		);
	});
}

// 	A sweep re-checks every eligible watch against every eligible counterpart,
// 	so without this filter it would re-attempt (and get a unique-constraint
// 	rejection for) every pairing that already matched in a prior sweep - cost
// 	that grows with accumulated matches rather than with what's actually new.
// 	One IN/IN query narrows candidates to genuinely new pairs before any
// 	insert is attempted.
async function filterOutExistingMatches(
	pairs: WatchPair[],
): Promise<WatchPair[]> {
	if (pairs.length === 0) return [];

	const wtbWatchIds = [...new Set(pairs.map((pair) => pair.wtbWatch.id))];
	const wtsWatchIds = [...new Set(pairs.map((pair) => pair.wtsWatch.id))];

	const existing = await prisma.marketplaceMatch.findMany({
		where: {
			wtbWatchId: { in: wtbWatchIds },
			wtsWatchId: { in: wtsWatchIds },
		},
		select: { wtbWatchId: true, wtsWatchId: true },
	});

	const existingKeys = new Set(
		existing.map((match) => `${match.wtbWatchId}:${match.wtsWatchId}`),
	);

	return pairs.filter(
		(pair) => !existingKeys.has(`${pair.wtbWatch.id}:${pair.wtsWatch.id}`),
	);
}

async function pairAndRecord(
	pairs: WatchPair[],
): Promise<MarketplaceMatchWithWatches[]> {
	const newPairs = await filterOutExistingMatches(
		await filterOutBlockedPairs(pairs),
	);

	const created: MarketplaceMatchWithWatches[] = [];
	for (const { wtbWatch, wtsWatch } of newPairs) {
		const match = await recordMarketplaceMatchIfNew(wtbWatch, wtsWatch);
		if (match) created.push(match);
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

	const user = await prisma.user.findUnique({
		where: { discordUserId: watch.discordUserId },
	});
	if (!user) return [];

	const watchWithUser: WatchWithUser = { ...watch, user };
	const candidates = await findEligibleWatchesByType(
		counterpartType(watch.watchType),
		{ server: watch.server, itemName: watch.itemName },
	);

	const pairs =
		watch.watchType === WatchType.WTB
			? buildCandidatePairs([watchWithUser], candidates)
			: buildCandidatePairs(candidates, [watchWithUser]);
	return pairAndRecord(pairs);
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

	const pairs: WatchPair[] = [];
	for (const wtbWatch of wtbWatches) {
		const key = `${wtbWatch.server}:${wtbWatch.itemName}`;
		const candidates = wtsByServerAndItem.get(key);
		if (!candidates) continue;

		pairs.push(...buildCandidatePairs([wtbWatch], candidates));
	}

	return pairAndRecord(pairs);
}

// 	The watches with at least one side still waiting to be told about a match.
// 	The digest is built per watch, so this is all the sweep needs to know.
export async function getWatchIdsWithPendingMarketplaceMatches(): Promise<
	number[]
> {
	const matches = await prisma.marketplaceMatch.findMany({
		where: {
			OR: [{ wtbNotifiedAt: null }, { wtsNotifiedAt: null }],
		},
		select: {
			wtbWatchId: true,
			wtsWatchId: true,
			wtbNotifiedAt: true,
			wtsNotifiedAt: true,
		},
	});

	const watchIds = new Set<number>();
	for (const match of matches) {
		if (!match.wtbNotifiedAt) watchIds.add(match.wtbWatchId);
		if (!match.wtsNotifiedAt) watchIds.add(match.wtsWatchId);
	}
	return [...watchIds];
}

// 	A deactivated watch's matches must be cleared, not just left unnotified -
// 	otherwise the unique constraint on [wtbWatchId, wtsWatchId] silently blocks
// 	a fresh match (and notification) once the watch is reactivated, since the
// 	stale row already has both sides marked notified.
export async function deleteMarketplaceMatchesForWatchIds(
	watchIds: number[],
): Promise<void> {
	if (watchIds.length === 0) return;
	await prisma.marketplaceMatch.deleteMany({
		where: {
			OR: [
				{ wtbWatchId: { in: watchIds } },
				{ wtsWatchId: { in: watchIds } },
			],
		},
	});
}

// 	One counterpart of a watch, as the watch's owner is allowed to see it.
export type MarketplaceCounterpart = {
	matchId: number;
	// 	which side of the match the owner's own watch is on
	side: MarketplaceMatchSide;
	// 	whether the owner has already been told about this match
	notified: boolean;
	watch: WatchWithUser;
};

export type MarketplaceWatchView = {
	watch: WatchWithUser;
	counterparts: MarketplaceCounterpart[];
};

const MATCH_SIDES = ['wtb', 'wts'] as const;

function isListed(watch: Watch): boolean {
	return watch.active && watch.isPublicallyTradeable;
}

// 	Everything a user can suppress is applied here, when a match is read,
// 	rather than when it is recorded, so lifting a suppression brings the match
// 	back: an unlisted watch, an ended counterpart and a hidden trader all leave
// 	the ledger row alone. Snooze is not applied here at all - a snoozed user
// 	stays listed and visible, and the digest send holds back their DMs. A
// 	block is the exception, and is mutual - see filterOutBlockedPairs. It is
// 	re-checked here because one added after the match was recorded must still
// 	keep the two out of each other's sight.
async function buildMarketplaceViews(
	watches: WatchWithUser[],
): Promise<MarketplaceWatchView[]> {
	const views = watches.map((watch) => ({
		watch,
		counterparts: [] as MarketplaceCounterpart[],
	}));
	const viewByWatchId = new Map(
		views
			.filter(({ watch }) => isListed(watch))
			.map((view) => [view.watch.id, view]),
	);
	if (viewByWatchId.size === 0) return views;

	const watchIds = [...viewByWatchId.keys()];
	const matches = await prisma.marketplaceMatch.findMany({
		where: {
			OR: [
				{ wtbWatchId: { in: watchIds } },
				{ wtsWatchId: { in: watchIds } },
			],
		},
		include: matchWithWatchesInclude,
		orderBy: { id: 'desc' },
	});

	for (const match of matches) {
		// 	a price edit on either side does not touch the match row, so this is
		// 	re-checked on every read rather than once when the pair was recorded -
		// 	the ledger itself is left alone, which is what lets compatibility (and
		// 	the view) come back on its own if the price is edited again
		if (!isPriceCompatible(match.wtbWatch, match.wtsWatch)) continue;
		for (const side of MATCH_SIDES) {
			const { mine, theirs } = sidesOfMatch(match, side);
			const view = viewByWatchId.get(mine.id);
			if (!view || !isListed(theirs)) continue;

			view.counterparts.push({
				matchId: match.id,
				side,
				notified: Boolean(
					side === 'wtb' ? match.wtbNotifiedAt : match.wtsNotifiedAt,
				),
				watch: theirs,
			});
		}
	}

	const viewerIds = [...new Set(watches.map((w) => w.discordUserId))];
	const counterpartIds = [
		...new Set(
			views.flatMap((view) =>
				view.counterparts.map((c) => c.watch.discordUserId),
			),
		),
	];
	if (counterpartIds.length === 0) return views;

	const [blocks, hidden] = await Promise.all([
		prisma.blockedTrader.findMany({
			where: {
				OR: [
					{
						discordUserId: { in: viewerIds },
						blockedDiscordUserId: { in: counterpartIds },
					},
					{
						discordUserId: { in: counterpartIds },
						blockedDiscordUserId: { in: viewerIds },
					},
				],
			},
			select: { discordUserId: true, blockedDiscordUserId: true },
		}),
		prisma.hiddenTrader.findMany({
			where: {
				discordUserId: { in: viewerIds },
				hiddenDiscordUserId: { in: counterpartIds },
			},
			select: { discordUserId: true, hiddenDiscordUserId: true },
		}),
	]);

	// 	keyed viewer:counterpart; a block is stored once but suppresses both ways
	const suppressed = new Set([
		...blocks.flatMap((b) => [
			`${b.discordUserId}:${b.blockedDiscordUserId}`,
			`${b.blockedDiscordUserId}:${b.discordUserId}`,
		]),
		...hidden.map((h) => `${h.discordUserId}:${h.hiddenDiscordUserId}`),
	]);

	for (const view of views) {
		view.counterparts = view.counterparts.filter(
			(c) =>
				!suppressed.has(
					`${view.watch.discordUserId}:${c.watch.discordUserId}`,
				),
		);
	}
	return views;
}

function sidesOfMatch(
	match: MarketplaceMatchWithWatches,
	side: MarketplaceMatchSide,
): { mine: WatchWithUser; theirs: WatchWithUser } {
	return side === 'wtb'
		? { mine: match.wtbWatch, theirs: match.wtsWatch }
		: { mine: match.wtsWatch, theirs: match.wtbWatch };
}

// 	One view per active watch, ordered for display. Unlisted watches are
// 	included, with no counterparts, so the caller can show their status.
export async function getMarketplaceViewsForUser(
	discordUserId: string,
): Promise<MarketplaceWatchView[]> {
	const watches = await prisma.watch.findMany({
		where: { discordUserId, active: true },
		include: { user: true },
		orderBy: [{ server: 'asc' }, { itemName: 'asc' }],
	});
	return buildMarketplaceViews(watches);
}

// 	Includes an ended watch (with no counterparts) so a message about it can
// 	still be re-rendered after it was ended. Null only when the watch is gone.
export async function getMarketplaceViewForWatch(
	watchId: number,
): Promise<MarketplaceWatchView | null> {
	const watch = await prisma.watch.findUnique({
		where: { id: watchId },
		include: { user: true },
	});
	if (!watch) return null;
	return (await buildMarketplaceViews([watch]))[0];
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
// 	deliberately left claimed - see sendMarketplaceDigest) so the next sweep
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

export const MARKETPLACE_NOTIFICATION_THROTTLE_HOURS = 24;

// 	Unlike a match claim, this survives the match row being deleted and
// 	recreated (deleteMarketplaceMatchesForWatchIds runs on every unwatch) -
// 	it is keyed on the two Discord users, the item/server and the recipient's
// 	own side, never on a matchId. That is what stops a counterparty from
// 	re-triggering a notification to the same recipient just by ending and
// 	restoring their own watch: the fresh match row is unclaimed, but this
// 	history still remembers they were told recently.
export async function filterOutRecentlyNotified(
	recipientDiscordUserId: string,
	itemName: string,
	server: Server,
	counterparts: MarketplaceCounterpart[],
): Promise<MarketplaceCounterpart[]> {
	if (counterparts.length === 0) return [];

	const counterpartIds = [
		...new Set(counterparts.map((c) => c.watch.discordUserId)),
	];
	const since = new Date(
		Date.now() - MARKETPLACE_NOTIFICATION_THROTTLE_HOURS * 60 * 60 * 1000,
	);
	const recent = await prisma.marketplaceNotificationHistory.findMany({
		where: {
			recipientDiscordUserId,
			itemName,
			server,
			counterpartDiscordUserId: { in: counterpartIds },
			notifiedAt: { gt: since },
		},
		select: { counterpartDiscordUserId: true, side: true },
	});
	if (recent.length === 0) return counterparts;

	const throttled = new Set(
		recent.map((row) => `${row.counterpartDiscordUserId}:${row.side}`),
	);
	return counterparts.filter(
		(c) => !throttled.has(`${c.watch.discordUserId}:${c.side}`),
	);
}

// 	Records that these counterparts were just notified, so a later match
// 	between the same two users on this item/server/side is held back for
// 	MARKETPLACE_NOTIFICATION_THROTTLE_HOURS even if the match row backing it
// 	is deleted and recreated in the meantime. Call only after a successful
// 	send - see sendMarketplaceDigest.
export async function recordMarketplaceNotifications(
	recipientDiscordUserId: string,
	itemName: string,
	server: Server,
	counterparts: MarketplaceCounterpart[],
): Promise<void> {
	if (counterparts.length === 0) return;

	for (const c of counterparts) {
		await prisma.marketplaceNotificationHistory.upsert({
			where: {
				recipientDiscordUserId_counterpartDiscordUserId_itemName_server_side:
					{
						recipientDiscordUserId,
						counterpartDiscordUserId: c.watch.discordUserId,
						itemName,
						server,
						side: c.side,
					},
			},
			create: {
				recipientDiscordUserId,
				counterpartDiscordUserId: c.watch.discordUserId,
				itemName,
				server,
				side: c.side,
			},
			update: { notifiedAt: new Date() },
		});
	}
}
