import { PrismaClient, Server, WatchType, User, Watch } from '@prisma/client';
import { ChatInputCommandInteraction, User as DiscordUser } from 'discord.js';
import { getExpirationTimestampForSnooze } from '../lib/helpers/datetime';

const prisma = new PrismaClient();

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
};

export async function upsertWatch(
	discordUserId: string,
	watchData: CreateWatchInputArgs,
) {
	// Upsert the watch
	return await prisma.watch.upsert({
		where: {
			discordUserId_itemName_server_watchType: {
				discordUserId: discordUserId,
				itemName: watchData.itemName,
				server: watchData.server,
				watchType: watchData.watchType,
			},
		},
		update: {
			itemName: watchData.itemName,
			server: watchData.server,
			active: true,
			created: new Date(),
			snoozedUntil: null,
		},
		create: {
			discordUserId: discordUserId,
			itemName: watchData.itemName,
			server: watchData.server,
			watchType: watchData.watchType,
			snoozedUntil: null,
		},
	});
}

export async function getWatchesByUser(discordUserId: string) {
	return prisma.watch.findMany({
		where: {
			discordUserId,
		},
	});
}

export async function getWatchesByDiscordUser(user: DiscordUser) {
	return prisma.watch.findMany({
		where: {
			discordUserId: user.id,
		},
	});
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

export async function extendAllWatches(discordUserId: string) {
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

	return getWatchesByUser(discordUserId);
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
