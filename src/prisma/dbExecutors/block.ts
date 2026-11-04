import type { Server } from '../client';
import type { Interaction } from 'discord.js';
import { prisma } from '../init';

export async function getPlayerBlocks(
	discordUserId: string,
	filter: string = '',
) {
	const blockedPlayers = await prisma.blockedPlayer.findMany({
		where: {
			discordUserId,
			active: true,
		},
	});

	if (filter) {
		return blockedPlayers.filter((bp) =>
			bp.player.includes(filter.toUpperCase()),
		);
	}

	return blockedPlayers;
}

export async function addPlayerBlock(
	discordUserId: string,
	player: string,
	server: Server,
) {
	return prisma.blockedPlayer.upsert({
		where: {
			discordUserId_server_player: {
				discordUserId,
				player: player.toUpperCase(),
				server,
			},
		},
		update: {
			discordUserId,
			player: player.toUpperCase(),
			server,
			active: true,
		},
		create: {
			discordUserId,
			player: player.toUpperCase(),
			server,
		},
	});
}

export async function restorePlayerBlockById(id: number) {
	// Update the blockedPlayer entry where the block id matches
	// the arguement id
	return prisma.blockedPlayer.update({
		where: {
			id,
		},
		data: {
			active: true,
		},
	});
}

export async function removePlayerBlockWithoutServer(
	interaction: Interaction,
	playerName: string,
) {
	const blockedPlayer = await prisma.blockedPlayer.findFirstOrThrow({
		where: {
			player: playerName.toUpperCase(),
			discordUserId: interaction.user.id,
		},
	});

	// Update the blockedPlayer entry by setting active to false where player = playerName
	return prisma.blockedPlayer.update({
		where: {
			id: blockedPlayer.id,
		},
		data: {
			active: false,
		},
	});
}

export async function removePlayerBlockById(id: number) {
	return prisma.blockedPlayer.update({
		where: {
			id,
		},
		data: {
			active: false,
		},
	});
}

export async function addPlayerBlockByWatch(
	discordUserId: string,
	watchId: number,
	player: string,
) {
	return await prisma.blockedPlayerByWatch.upsert({
		where: {
			watchId_player: {
				watchId: watchId,
				player: player.toUpperCase(),
			},
		},
		update: {}, // No op, using upsert to swallow any insert conflict errors
		create: {
			watchId: watchId,
			player: player.toUpperCase(),
			discordUserId,
		},
	});
}

export async function removeWatchBlockByPlayerName(
	watchId: number,
	player: string,
) {
	return prisma.blockedPlayerByWatch.delete({
		where: {
			watchId_player: {
				watchId,
				player: player.toUpperCase(),
			},
		},
	});
}

// 	Keyed on discord user rather than character name - see BlockedTrader in
// 	schema.prisma. The upsert swallows a repeat block instead of erroring.
export async function addTraderBlock(
	discordUserId: string,
	blockedDiscordUserId: string,
) {
	return prisma.blockedTrader.upsert({
		where: {
			discordUserId_blockedDiscordUserId: {
				discordUserId,
				blockedDiscordUserId,
			},
		},
		update: {},
		create: { discordUserId, blockedDiscordUserId },
	});
}

// 	Returns the number of blocks removed so the caller can tell "unblocked"
// 	from "there was no block".
export async function removeTraderBlock(
	discordUserId: string,
	blockedDiscordUserId: string,
): Promise<number> {
	const result = await prisma.blockedTrader.deleteMany({
		where: { discordUserId, blockedDiscordUserId },
	});
	return result.count;
}

export async function getTraderBlocks(discordUserId: string) {
	return prisma.blockedTrader.findMany({
		where: { discordUserId },
		orderBy: { createdAt: 'asc' },
	});
}

// 	A hide is one-way and only filters what the user is shown - see
// 	HiddenTrader in schema.prisma.
export async function hideTrader(
	discordUserId: string,
	hiddenDiscordUserId: string,
) {
	return prisma.hiddenTrader.upsert({
		where: {
			discordUserId_hiddenDiscordUserId: {
				discordUserId,
				hiddenDiscordUserId,
			},
		},
		update: {},
		create: { discordUserId, hiddenDiscordUserId },
	});
}

// 	Returns the number of hides removed so the caller can tell "unhidden"
// 	from "was not hidden".
export async function unhideTrader(
	discordUserId: string,
	hiddenDiscordUserId: string,
): Promise<number> {
	const result = await prisma.hiddenTrader.deleteMany({
		where: { discordUserId, hiddenDiscordUserId },
	});
	return result.count;
}

// 	The username is only known when the hidden trader has a User row of their
// 	own (they have made a watch); autocomplete falls back to the id otherwise.
export async function getHiddenTraders(discordUserId: string) {
	const hidden = await prisma.hiddenTrader.findMany({
		where: { discordUserId },
		orderBy: { createdAt: 'asc' },
	});
	const users = await prisma.user.findMany({
		where: {
			discordUserId: { in: hidden.map((h) => h.hiddenDiscordUserId) },
		},
		select: { discordUserId: true, discordUsername: true },
	});
	const usernames = new Map(
		users.map((u) => [u.discordUserId, u.discordUsername]),
	);
	return hidden.map((h) => ({
		hiddenDiscordUserId: h.hiddenDiscordUserId,
		discordUsername: usernames.get(h.hiddenDiscordUserId),
	}));
}
