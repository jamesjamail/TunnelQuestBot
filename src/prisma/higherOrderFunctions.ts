/* eslint-disable @typescript-eslint/no-explicit-any */
import { Interaction } from 'discord.js';
import { prisma } from './init';

//  users table PK is discord user id. feels like a waste to look it up everytime
//  when they only need to be created once.  let's assume they exist and catch the
//  the error if it fails.  If it's the specific FK violation error, then create the
//  user and try again.
export async function attemptAndCreateUserIfNeeded(
	interaction: Interaction,
	action: () => Promise<any>,
): Promise<any> {
	try {
		return await action();
	} catch (error) {
		if (isForeignKeyViolationError(error)) {
			await ensureUserExists(interaction.user);
			return await action();
		}
		throw error;
	}
}

async function ensureUserExists(user: Interaction['user']): Promise<void> {
	await prisma.user.upsert({
		where: { discordUserId: user.id },
		update: {},
		create: {
			discordUserId: user.id,
			discordUsername: user.username,
		},
	});
}

function isForeignKeyViolationError(error: any): boolean {
	const field = error.meta?.constraint ?? error.meta?.field_name ?? '';
	return error.code === 'P2003' && field.includes('discordUserId');
}
