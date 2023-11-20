import { PlayerLink, Server, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { add } from 'date-fns';
import { Interaction } from 'discord.js';
import { attemptAndCreateUserIfNeeded } from '../higherOrderFunctions';
import { prisma } from '../init';

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

export async function insertPlayerLinkFull(link: PlayerLink) {
	return prisma.playerLink.create({
		data: link,
	});
}

export async function removePlayerLink(
	user_id: string,
	player: string,
	server: Server,
) {
	try {
		await prisma.playerLink.delete({
			where: {
				server_player: { server: server, player: player },
				discordUserId: user_id,
			},
		});
		return true;
	} catch {
		return false;
	}
}

export async function removePlayerLinkById(id: number) {
	try {
		await prisma.playerLink.delete({
			where: {
				id: id,
			},
		});
		return true;
	} catch {
		return false;
	}
}

export async function runPlayerLinkHousekeeping() {
	const deletedPlayerLinks = await prisma.playerLink.deleteMany({
		where: {
			linkCodeExpiry: {
				lt: new Date(),
				not: null,
			},
		},
	});

	if (deletedPlayerLinks.count > 0) {
		// eslint-disable-next-line no-console
		console.info(
			`Deleted ${deletedPlayerLinks.count} expired PlayerLink entries.`,
		);
	}
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

export async function getPlayerLinksForUser(user_id: string) {
	return prisma.playerLink.findMany({
		where: {
			discordUserId: user_id,
		},
	});
}
