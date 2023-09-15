import {
	PrismaClient,
	Server,
	WatchType,
	User,
	Watch,
	SnoozedUser,
} from '@prisma/client';
import { User as DiscordUser } from 'discord.js';
import { getExpirationTimestampForSnooze } from '../lib/helpers/datetime';
import {
	formatSnoozedWatchResult,
	removeSnoozedWatchDataFromFormattedResult,
} from '../lib/helpers/helpers';

const prisma = new PrismaClient();

// perhaps there is a way to skip this step, since we have users id'ed by their discordUserId
// find a way to catch the error if their id doesnt exist, then findOrCreate and try again.
export async function findOrCreateUser(
	discordUser: DiscordUser,
): Promise<User & { snoozedUsers: SnoozedUser[] }> {
	const user = await prisma.user.findUnique({
		where: {
			discordUserId: discordUser.id,
		},
		include: {
			snoozedUsers: true,
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
		include: {
			snoozedUsers: true,
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
	// delete any snoozedWatches associated with this watch
	await prisma.snoozedWatch.deleteMany({
		where: {
			watch: {
				discordUserId: discordUserId,
				itemName: watchData.itemName,
				server: watchData.server,
				watchType: watchData.watchType,
			},
		},
	});
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
		},
		create: {
			discordUserId: discordUserId,
			itemName: watchData.itemName,
			server: watchData.server,
			watchType: watchData.watchType,
		},
		include: {
			snoozedWatches: true,
		},
	});
}

export async function getWatchesByUser(user: User) {
	return prisma.watch.findMany({
		where: {
			discordUserId: user.discordUserId,
		},
		include: {
			snoozedWatches: true,
		},
	});
}

export type MetadataType = {
	id: number;
};

export async function snoozeWatch(metadata: Watch) {
	const result = await prisma.snoozedWatch.upsert({
		where: {
			watchId: metadata.id,
		},
		update: {
			// technically, this will never get updated as we are
			// responding to an inactive watch snooze event
			endTimestamp: getExpirationTimestampForSnooze(),
			watchId: metadata.id,
		},
		create: {
			endTimestamp: getExpirationTimestampForSnooze(),
			watchId: metadata.id,
		},
		include: {
			watch: true,
		},
	});
	return formatSnoozedWatchResult(result);
}

export async function unsnoozeWatch(metadata: Watch) {
	const result = await prisma.snoozedWatch.delete({
		where: {
			watchId: metadata.id,
		},
		include: {
			watch: true,
		},
	});
	// prisma's delete returns the deleted entry, which we don't want
	// let's delete it ourselves to save an extra db query
	const formattedDataToCorrect = formatSnoozedWatchResult(result);
	return removeSnoozedWatchDataFromFormattedResult(
		result,
		formattedDataToCorrect,
	);
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
		include: {
			snoozedWatches: true,
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
		include: {
			snoozedWatches: true,
		},
	});

	return result;
}

export async function extendAllWatches(metadata: User) {
	// extending all watches should end any global snooze if active
	// rather than make an extra query, let's just try execute it
	// and fail silently if it's the expected error
	try {
		await prisma.snoozedUser.delete({
			where: {
				discordUserId: metadata.discordUserId,
			},
		});
	} catch (error) {
		if (error.code !== 'P2025') {
			// P2025 is Prisma's code for record not found
			// eslint-disable-next-line no-console
			console.error(
				'Unexpected error while deleting snoozedUser:',
				error,
			);
			throw error;
		}
	}

	// Extend the watches for this user
	await prisma.watch.updateMany({
		where: {
			discordUserId: metadata.discordUserId,
		},
		data: {
			created: new Date(),
			active: true,
		},
	});

	return getWatchesByUser(metadata);
}

export async function snoozeAllWatches(metadata: User) {
	await prisma.snoozedUser.upsert({
		where: {
			discordUserId: metadata.discordUserId,
		},
		update: {
			endTimestamp: getExpirationTimestampForSnooze(),
		},
		create: {
			discordUserId: metadata.discordUserId,
			endTimestamp: getExpirationTimestampForSnooze(),
		},
	});
	return getWatchesByUser(metadata);
}
