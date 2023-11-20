import { Server } from '@prisma/client';
import { Interaction } from 'discord.js';
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
		},
		create: {
			discordUserId,
			player: player.toUpperCase(),
			server,
		},
	});
}

export async function removePlayerBlock(
	discordUserId: string,
	player: string,
	server: Server,
) {
	return prisma.blockedPlayer.update({
		where: {
			discordUserId_server_player: {
				discordUserId,
				player: player.toUpperCase(),
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

export async function removePlayerBlockByWatch(
	watchId: number,
	player: string,
) {
	return await prisma.blockedPlayerByWatch.delete({
		where: {
			watchId_player: {
				watchId: watchId,
				player: player.toUpperCase(),
			},
		},
	});
}
