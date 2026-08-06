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

//  Prisma 7 reports the violated constraint through the driver adapter's error
//  cause instead of the flat `meta.constraint`/`meta.field_name` of earlier
//  versions. Postgres names the constraint (`Watch_discordUserId_fkey`), but
//  other drivers report bare column names, so check both shapes.
type ForeignKeyViolationMeta = {
	driverAdapterError?: {
		cause?: { constraint?: { index?: string; fields?: string[] } };
	};
};

function isForeignKeyViolationError(error: any): boolean {
	if (error?.code !== 'P2003') return false;

	const constraint = (error.meta as ForeignKeyViolationMeta | undefined)
		?.driverAdapterError?.cause?.constraint;

	return [constraint?.index ?? '', ...(constraint?.fields ?? [])].some(
		(name) => name.includes('discordUserId'),
	);
}
