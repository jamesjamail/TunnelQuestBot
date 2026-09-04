import { User as DiscordUser } from 'discord.js';
import { prisma } from '../init';
import { User } from '../client';

export async function findOrCreateUser(
	discordUser: DiscordUser,
): Promise<User> {
	return prisma.user.upsert({
		where: { discordUserId: discordUser.id },
		update: {},
		create: {
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
		},
	});
}
