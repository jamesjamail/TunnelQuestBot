import type { Interaction } from 'discord.js';
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

//  Prisma 7 + @prisma/adapter-pg reports the violated constraint through the
//  driver adapter's error cause. Postgres names the constraint
//  (`Watch_discordUserId_fkey`); other drivers report bare column names, so both
//  shapes are checked.
//
//  Deliberately no fallbacks for the flat `meta.field_name`/`meta.constraint` of
//  v5/v6, or for the rendered message. prisma, @prisma/client and
//  @prisma/adapter-pg are pinned together at ^7.9.1, so those shapes cannot
//  occur without a deliberate downgrade — and if Prisma relocates this again,
//  higherOrderFunctions.itest.ts is what catches it: it drives a real P2003
//  against real Postgres through the same adapter production uses, so the build
//  goes red before anything ships. Fallbacks would only soften a failure that
//  had already got past a red build, and matching the message would mean
//  trusting Prisma's prose to stay put — a weaker assumption than the one about
//  structured fields this comment declines to make.
type ForeignKeyViolationMeta = {
	driverAdapterError?: {
		cause?: { constraint?: { index?: string; fields?: string[] } };
	};
};

function isForeignKeyViolationError(error: unknown): boolean {
	if (!isRecord(error) || error.code !== 'P2003') return false;

	const meta = isRecord(error.meta)
		? (error.meta as ForeignKeyViolationMeta)
		: undefined;
	const constraint = meta?.driverAdapterError?.cause?.constraint;

	return [constraint?.index, ...(constraint?.fields ?? [])].some(
		(name) => typeof name === 'string' && name.includes(USER_FK_COLUMN),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
