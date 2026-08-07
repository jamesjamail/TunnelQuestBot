import { Interaction } from 'discord.js';
import { prisma } from './init';

//  users table PK is discord user id. feels like a waste to look it up everytime
//  when they only need to be created once.  let's assume they exist and catch the
//  the error if it fails.  If it's the specific FK violation error, then create the
//  user and try again.
export async function attemptAndCreateUserIfNeeded<T>(
	interaction: Interaction,
	action: () => Promise<T>,
): Promise<T> {
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

const USER_FK_COLUMN = 'discordUserId';

//  Prisma has moved this detail twice now: `meta.field_name` in v5/v6, and in
//  v7 the driver adapter's error cause. Each move silently broke lazy user
//  creation, because a missed FK violation just rethrows and the user's first
//  command fails. All three shapes are checked so the next move degrades into
//  redundancy rather than an outage.
type ForeignKeyViolationMeta = {
	//  Prisma 7 + @prisma/adapter-pg. Postgres names the constraint
	//  (`Watch_discordUserId_fkey`); other drivers report bare column names.
	driverAdapterError?: {
		cause?: { constraint?: { index?: string; fields?: string[] } };
	};
	//  Prisma 6 and earlier
	field_name?: string;
	constraint?: string | string[];
};

function isForeignKeyViolationError(error: unknown): boolean {
	if (!isRecord(error) || error.code !== 'P2003') return false;

	const meta = isRecord(error.meta)
		? (error.meta as ForeignKeyViolationMeta)
		: undefined;
	const constraint = meta?.driverAdapterError?.cause?.constraint;

	const candidates = [
		constraint?.index,
		...(constraint?.fields ?? []),
		meta?.field_name,
		...(Array.isArray(meta?.constraint)
			? meta.constraint
			: [meta?.constraint]),
		//  last resort: the rendered message still names the constraint when
		//  the structured fields have moved again
		typeof error.message === 'string' ? error.message : undefined,
	];

	return candidates.some(
		(name) => typeof name === 'string' && name.includes(USER_FK_COLUMN),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
