import {
	Server,
	type WatchType,
	type Watch,
	type BlockedPlayerByWatch,
	type User,
} from '../client';
import type {
	Interaction,
	ChatInputCommandInteraction,
	User as DiscordUser,
} from 'discord.js';
import { config } from '../../config';
import { getExpirationTimestampForSnooze } from '../../lib/helpers/datetime';
import {
	isKnownItem,
	normalizeStoredWatchItemName,
} from '../../lib/helpers/watches';
import { resolveCanonicalItemName } from '../../lib/gameData/consolidatedItems';
import { attemptAndCreateUserIfNeeded } from '../higherOrderFunctions';
import { prisma } from '../init';

type CreateWatchInputArgs = {
	itemName: string;
	server: Server;
	watchType: WatchType;
	priceRequirement?: number;
	notes?: string;
};

export async function upsertWatch(
	discordUserId: string,
	watchData: CreateWatchInputArgs,
) {
	const { server, watchType, priceRequirement, notes } = watchData;
	const itemName = normalizeStoredWatchItemName(watchData.itemName);

	// allow users to erase previously set price requirements by inputting 0 or less
	const updatedPriceRequirement =
		priceRequirement !== undefined && priceRequirement <= 0
			? null
			: priceRequirement;

	return prisma.watch.upsert({
		where: {
			discordUserId_itemName_server_watchType: {
				discordUserId,
				itemName,
				server,
				watchType,
			},
		},
		update: {
			itemName,
			server: watchData.server,
			priceRequirement: updatedPriceRequirement,
			active: true,
			created: new Date(),
			snoozedUntil: null,
			notes,
		},
		create: {
			discordUserId,
			itemName,
			server,
			watchType,
			snoozedUntil: null,
			priceRequirement: updatedPriceRequirement,
			notes,
		},
	});
}

export async function upsertWatchSafely(
	interaction: Interaction,
	watchData: CreateWatchInputArgs,
) {
	return await attemptAndCreateUserIfNeeded(
		interaction,
		async () => await upsertWatch(interaction.user.id, watchData),
	);
}

export async function setWatchActiveByWatchId(id: number) {
	// update the watch
	return prisma.watch.update({
		where: {
			id,
		},
		data: {
			active: true,
			snoozedUntil: null, //	reactivating a watch should unsnooze it
		},
	});
}

export async function getWatchesByUser(discordUserId: string) {
	return prisma.watch.findMany({
		where: {
			discordUserId,
			active: true,
		},
	});
}

export async function getWatchesByDiscordUser(user: DiscordUser) {
	return getWatchesByUser(user.id);
}

export async function getSnoozedWatchesByDiscordUser(user: DiscordUser) {
	return prisma.watch.findMany({
		where: {
			discordUserId: user.id,
			active: true,
			snoozedUntil: {
				gt: new Date(), //	expiration has not yet passed
			},
		},
	});
}

export async function getWatchByItemName(
	discordUserId: string,
	itemName: string,
) {
	const watches = await getWatchesByUser(discordUserId);
	const normalizedItemName = normalizeStoredWatchItemName(itemName);
	const filteredWatches = watches.filter((watch) => {
		return watch.itemName === normalizedItemName;
	});

	// it's possible a user could have multiple watches for the same item
	// across varies servers and watch types.  simply return the first, as
	// this is being used as a good faith effort when autocomplete fails.
	return filteredWatches[0];
}

export async function getWatchesByItemName(
	discordUserId: string,
	itemName = '',
) {
	const watches = await getWatchesByUser(discordUserId);
	return watches.filter((watch) => {
		return watch.itemName.includes(itemName.toUpperCase());
	});
}

export type MetadataType = {
	id: number;
};

export async function snoozeWatch(metadata: Watch, hours?: number) {
	// intentionally an update as this function is used to interact with existing watches
	return prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(hours),
		},
	});
}

export async function unsnoozeWatch(metadata: Watch) {
	return prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			snoozedUntil: null,
		},
	});
}

export async function unsnoozeWatchByItemName(
	interaction: Interaction,
	watchName: string,
) {
	const watch = await prisma.watch.findFirstOrThrow({
		where: {
			itemName: normalizeStoredWatchItemName(watchName),
			discordUserId: interaction.user.id,
		},
	});

	// Update the watch entry by setting snoozedUntil to null where itemName = itemName
	return prisma.watch.update({
		where: {
			id: watch.id,
		},
		data: {
			snoozedUntil: null,
		},
	});
}

export async function unwatch(metadata: MetadataType) {
	// Update the watch entry where the id matches metadata.id
	return prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			active: false,
			snoozedUntil: null, //	unwatching should remove any snooze
		},
	});
}

export async function unwatchByWatchName(
	interaction: Interaction,
	watchName: string,
) {
	// First, find the watch entry based on itemName and discordUserId
	const watch = await prisma.watch.findFirstOrThrow({
		where: {
			itemName: normalizeStoredWatchItemName(watchName),
			discordUserId: interaction.user.id,
		},
	});

	// Update the watch entry found above to set active to false
	return prisma.watch.update({
		where: {
			id: watch.id,
		},
		data: {
			active: false,
		},
	});
}

export async function unwatchAllWatches(interaction: Interaction) {
	const discordUserId = interaction.user.id;
	return await prisma.watch.updateMany({
		where: { discordUserId },
		data: { active: false },
	});
}

export async function extendWatch(metadata: MetadataType) {
	return prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			created: new Date(),
			active: true,
		},
	});
}

export async function extendAllWatchesAndReturnWatches(discordUserId: string) {
	// extending all watches should end any global snooze if active
	await prisma.user.update({
		where: {
			discordUserId,
		},
		data: {
			snoozedUntil: null,
		},
	});

	// Extend the watches for this user
	await prisma.watch.updateMany({
		where: {
			discordUserId: discordUserId,
			active: true,
		},
		data: {
			created: new Date(),
		},
	});

	return getWatchesByUser(discordUserId);
}

export async function extendAllWatchesAndReturnUserAndWatches(
	discordUserId: string,
) {
	// extending all watches should end any global snooze if active
	const user = await prisma.user.update({
		where: {
			discordUserId,
		},
		data: {
			snoozedUntil: null,
		},
	});

	// Extend the watches for this user
	await prisma.watch.updateMany({
		where: {
			discordUserId: discordUserId,
			active: true,
		},
		data: {
			created: new Date(),
		},
	});

	const watches = await getWatchesByUser(discordUserId);

	return { watches, user };
}

export async function snoozeAllWatches(discordUserId: string) {
	await prisma.user.update({
		where: {
			discordUserId,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(),
		},
	});
	return getWatchesByUser(discordUserId);
}

export async function snoozeAllWatchesAndReturnWatchesAndUser(
	discordUserId: string,
) {
	const user = await prisma.user.update({
		where: {
			discordUserId,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(),
		},
	});

	const watches = await getWatchesByUser(discordUserId);

	return { user, watches };
}

export async function snoozeWatchByItemName(
	interaction: ChatInputCommandInteraction,
	itemName: string,
	hours?: number,
) {
	// First, find the watch by itemName - let's make a good faith
	// effort to find a watch by name in case autocomplete fails for some reason
	// it's technically possible a user could have multiple watches matching this
	// criterion since we don't know about server or watchType, but that's ok.

	// why not use updateMany? because the response is a mere record count.
	const foundWatch = await prisma.watch.findFirstOrThrow({
		where: {
			itemName: normalizeStoredWatchItemName(itemName),
			discordUserId: interaction.user.id,
		},
	});

	// Then, use the found watch's id to update its snooze
	return prisma.watch.update({
		where: {
			id: foundWatch.id,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(hours),
		},
	});
}

export async function fetchActiveWatches() {
	return prisma.watch.findMany({
		where: {
			active: true,
		},
	});
}

export type GroupedWatchesType = {
	[K in Server]: {
		[L in WatchType]: {
			knownItems: Record<string, number[]>;
			unknownItems: { item: string; watchIds: number[] }[];
		};
	};
};

export const initializeGroupedWatches = (): GroupedWatchesType => {
	const obj: Partial<GroupedWatchesType> = {};

	for (const server of Object.values(Server)) {
		obj[server] = {
			WTB: { knownItems: {}, unknownItems: [] },
			WTS: { knownItems: {}, unknownItems: [] },
		};
	}

	return obj as GroupedWatchesType;
};

export async function getWatchesGroupedByServer() {
	const watches = await fetchActiveWatches();
	const groupedWatches = initializeGroupedWatches();

	for (const watch of watches) {
		const server = watch.server;
		const watchType = watch.watchType;
		const itemName = watch.itemName;

		if (isKnownItem(itemName)) {
			const canonicalName = resolveCanonicalItemName(itemName);
			if (!groupedWatches[server][watchType].knownItems[canonicalName]) {
				groupedWatches[server][watchType].knownItems[canonicalName] =
					[];
			}
			groupedWatches[server][watchType].knownItems[canonicalName].push(
				watch.id,
			);
		} else {
			// Check if the item already exists in unknownItems
			const existingUnknownItem = groupedWatches[server][
				watchType
			].unknownItems.find((ui) => ui.item === itemName);
			if (existingUnknownItem) {
				existingUnknownItem.watchIds.push(watch.id);
			} else {
				groupedWatches[server][watchType].unknownItems.push({
					item: itemName,
					watchIds: [watch.id],
				});
			}
		}
	}

	return groupedWatches;
}

export async function getWatchByWatchId(watchId: number): Promise<Watch> {
	const data = await prisma.watch.findUnique({
		where: {
			id: watchId,
		},
	});

	if (!data) {
		throw new Error(`Error querying db for watch id ${watchId}`);
	}

	return data;
}

export type WatchWithUserAndBlockedWatches = Watch & {
	user: User;
	blockedWatches: BlockedPlayerByWatch[];
};

// 	Returns null when the watch is gone. Watches expire and are deleted
// 	continuously, so callers routinely hold an id that no longer resolves - that
// 	is an expected outcome to handle, not an error to throw on.
export async function getWatchByWatchIdForWatchNotification(
	watchId: number,
): Promise<WatchWithUserAndBlockedWatches | null> {
	return prisma.watch.findUnique({
		where: {
			id: watchId,
		},
		include: {
			user: true, // Include related User data
			blockedWatches: true, // Include related BlockedPlayerByWatch data
		},
	});
}

export async function deleteWatchesOlderThanWatchdurationDays() {
	const watchDuration = config().WATCH_DURATION_IN_DAYS;
	const watchDurationDaysAgo = new Date();
	watchDurationDaysAgo.setDate(
		watchDurationDaysAgo.getDate() - watchDuration,
	);

	const result = await prisma.watch.deleteMany({
		where: {
			created: {
				lt: watchDurationDaysAgo,
			},
		},
	});

	if (result.count > 0) {
		console.info(`Deleted ${result.count} expired watches.`);
	}
}
