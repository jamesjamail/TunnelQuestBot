import type { Interaction } from 'discord.js';
import { prisma } from './init';

// SQLite foreign-key errors do not identify the violated column. Ensure the
// Discord user exists before the action instead of guessing which key failed.
export async function attemptAndCreateUserIfNeeded<T>(
	interaction: Interaction,
	action: () => Promise<T>,
): Promise<T> {
	await prisma.user.upsert({
		where: { discordUserId: interaction.user.id },
		update: {},
		create: {
			discordUserId: interaction.user.id,
			discordUsername: interaction.user.username,
		},
	});
	return action();
}
