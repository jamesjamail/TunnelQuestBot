import { Server, WatchType, User, Watch } from '@prisma/client';
import {
	ChatInputCommandInteraction,
	User as DiscordUser,
	Interaction,
} from 'discord.js';
import { getExpirationTimestampForSnooze } from '../lib/helpers/datetime';
import { attemptAndCreateUserIfNeeded } from './higherOrderFunctions';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';
import { prisma } from './init';

export async function createUser(discordUser: DiscordUser) {
	return await prisma.user.create({
		data: {
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
		},
	});
}

// perhaps there is a way to skip this step, since we have users id'ed by their discordUserId
// find a way to catch the error if their id doesnt exist, then findOrCreate and try again.
export async function findOrCreateUser(
	discordUser: DiscordUser,
): Promise<User> {
	const user = await prisma.user.findUnique({
		where: {
			discordUserId: discordUser.id,
		},
	});

	if (user) {
		return user;
	}

	const createdUser = await prisma.user.create({
		data: {
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
		},
	});

	return createdUser;
}

type CreateWatchInputArgs = {
	itemName: string;
	server: Server;
	watchType: WatchType;
	notes?: string;
};

export async function upsertWatch(
	discordUserId: string,
	watchData: CreateWatchInputArgs,
) {
	const { itemName, server, watchType, notes } = watchData;
	// Upsert the watch
	return await prisma.watch.upsert({
		where: {
			discordUserId_itemName_server_watchType: {
				discordUserId,
				itemName,
				server,
				watchType,
			},
		},
		update: {
			itemName: watchData.itemName,
			server: watchData.server,
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

export async function insertPlayerLinkSafely(interaction: Interaction) {
	return await attemptAndCreateUserIfNeeded(interaction, async () =>
		insertPlayerLink(interaction.user.id),
	);
}

export async function insertPlayerLink(discord_id: string) {
	const linkCode = randomUUID();
	await prisma.playerLink.create({
		data: {
			discordUserId: discord_id,
			linkCode: linkCode,
			linkCodeExpiry: add(new Date(), { hours: 1 }),
		},
	});
	return linkCode;
}

export async function runPlayerLinkHousekeeping() {
	return prisma.playerLink.deleteMany({
		where: {
			linkCodeExpiry: { lt: new Date() },
			player: { not: null },
		},
	});
}

export async function authPlayerLink(
	player: string,
	server: Server,
	linkCode: string,
) {
	try {
		const linkEntry = await prisma.playerLink.findFirstOrThrow({
			where: {
				linkCode: linkCode,
			},
		});
		return await prisma.playerLink.update({
			where: {
				id: linkEntry.id,
			},
			data: {
				server: server,
				player: player,
				linkCode: null,
				linkCodeExpiry: null,
			},
		});
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			if (e.code == 'P2002') {
				// Unique Constraint Violation
				// eslint-disable-next-line no-console
				console.log(
					`Player \`${server}.${player}\` tried to use a new linkCode, but is already linked.`,
				);
			} else if (e.code == 'P2025') {
				// Record Not Found
				// eslint-disable-next-line no-console
				console.log(
					`Player \`${server}.${player}\` attempted to link with invalid linkCode \`${linkCode}\``,
				);
			} else {
				// eslint-disable-next-line no-console
				console.log(e);
			}
		} else {
			// eslint-disable-next-line no-console
			console.log(
				`Unknown Error when player \`${server}.${player}\` attempted to link with linkCode \`${linkCode}\`: ${e}`,
			);
		}
	}
}

export async function getPlayerLink(player: string, server: Server) {
	return prisma.playerLink.findUnique({
		where: {
			server_player: {
				server: server,
				player: player,
			},
		},
	});
}

export async function setWatchActiveByWatchId(id: number) {
	// update the watch
	return await prisma.watch.update({
		where: {
			id,
		},
		data: {
			active: true,
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
	return prisma.watch.findMany({
		where: {
			discordUserId: user.id,
			active: true,
		},
	});
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

export async function getWatchesByItemName(
	discordUserId: string,
	itemName = '',
) {
	const watches = await getWatchesByUser(discordUserId);
	const filteredWatches = watches.filter((watch) => {
		return watch.itemName.includes(itemName);
	});
	return filteredWatches;
}

export type MetadataType = {
	id: number;
};

export async function snoozeWatch(metadata: Watch, hours?: number) {
	// intentionally an update as this function is used to interact with existing watches
	return await prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(hours),
		},
	});
}

export async function unsnoozeWatch(metadata: Watch) {
	return await prisma.watch.update({
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
			itemName: watchName,
			discordUserId: interaction.user.id,
		},
	});

	// Update the watch entry by setting snoozedUntil to null where itemName = itemName
	return await prisma.watch.update({
		where: {
			id: watch.id,
		},
		data: {
			snoozedUntil: null,
		},
	});
}

export async function unwatch(metadata: MetadataType) {
	// Update the watch entry by setting active to false where the id matches metadata.id
	const result = await prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			active: false,
		},
	});

	return result;
}

export async function unwatchByWatchName(
	interaction: Interaction,
	watchName: string,
) {
	const watch = await prisma.watch.findFirstOrThrow({
		where: {
			itemName: watchName,
			discordUserId: interaction.user.id,
		},
	});

	// Update the watch entry by setting active to false where itemName = itemName
	const result = await prisma.watch.update({
		where: {
			id: watch.id,
		},
		data: {
			active: false,
		},
	});

	return result;
}

export async function extendWatch(metadata: MetadataType) {
	const result = await prisma.watch.update({
		where: {
			id: metadata.id,
		},
		data: {
			created: new Date(),
			active: true,
		},
	});

	return result;
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
		},
		data: {
			created: new Date(),
			active: true,
		},
	});

	return await getWatchesByUser(discordUserId);
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
		},
		data: {
			created: new Date(),
			active: true,
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
	return await getWatchesByUser(discordUserId);
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
	// criteria since we don't know about server or watchType, but that's ok.

	// why not use updateMany? because the response is a mere record count.
	const foundWatch = await prisma.watch.findFirstOrThrow({
		where: {
			itemName: itemName,
			discordUserId: interaction.user.id,
		},
	});

	// Then, use the found watch's id to update it's snooze
	return await prisma.watch.update({
		where: {
			id: foundWatch.id,
		},
		data: {
			snoozedUntil: getExpirationTimestampForSnooze(hours),
		},
	});
}

export async function getPlayerBlocks(
	interaction: Interaction,
	filter: string = '',
) {
	const blockedPlayers = await prisma.blockedPlayer.findMany({
		where: {
			discordUserId: interaction.user.id,
			active: true,
		},
	});

	if (filter) {
		return blockedPlayers.filter((bp) => bp.player.includes(filter));
	}

	return blockedPlayers;
}

export async function addPlayerBlock(
	discordUserId: string,
	player: string,
	server: Server,
) {
	return await prisma.blockedPlayer.upsert({
		where: {
			discordUserId_server_player: {
				discordUserId,
				player,
				server,
			},
		},
		update: {
			discordUserId,
			player,
			server,
		},
		create: {
			discordUserId,
			player,
			server,
		},
	});
}

export async function removePlayerBlock(
	discordUserId: string,
	player: string,
	server: Server,
) {
	return await prisma.blockedPlayer.update({
		where: {
			discordUserId_server_player: {
				discordUserId,
				player,
				server,
			},
		},
		data: {
			active: false,
		},
	});
}

export async function removePlayerBlockWithoutServer(
	interaction: Interaction,
	playerName: string,
) {
	const blockedPlayer = await prisma.blockedPlayer.findFirstOrThrow({
		where: {
			player: playerName,
			discordUserId: interaction.user.id,
		},
	});

	// Update the blockedPlayer entry by setting active to false where player = playerName
	return await prisma.blockedPlayer.update({
		where: {
			id: blockedPlayer.id,
		},
		data: {
			active: false,
		},
	});
}

export async function removePlayerBlockById(id: number) {
	return await prisma.blockedPlayer.update({
		where: {
			id,
		},
		data: {
			active: false,
		},
	});
}

async function fetchActiveWatches() {
	return await prisma.watch.findMany({
		where: {
			active: true,
		},
	});
}
export type GroupedWatchesType = {
	[K in Server]: {
		[L in WatchType]: Record<string, number[]>;
	};
};

export const initializeGroupedWatches = (): GroupedWatchesType => {
	const obj: Partial<GroupedWatchesType> = {};

	for (const server of Object.values(Server)) {
		obj[server] = {
			WTB: {},
			WTS: {},
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

		if (!groupedWatches[server][watchType][itemName]) {
			groupedWatches[server][watchType][itemName] = [];
		}

		groupedWatches[server][watchType][itemName].push(watch.id);
	}

	return groupedWatches;
}
