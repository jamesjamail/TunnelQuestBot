import { User as DiscordUser } from 'discord.js';
import { prisma } from '../init';
import { User } from '@prisma/client';

export async function createUser(discordUser: DiscordUser) {
	return prisma.user.create({
		data: {
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
		},
	});
}

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

	return prisma.user.create({
		data: {
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
		},
	});
}
