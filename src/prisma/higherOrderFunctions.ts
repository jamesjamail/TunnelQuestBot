/* eslint-disable @typescript-eslint/no-explicit-any */
import { Interaction } from 'discord.js';
import { createUser } from './dbExecutors';

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
			await createUser(interaction.user);
			return await action();
		}
		throw error; // If it's not the foreign key error we're expecting, re-throw it
	}
}

function isForeignKeyViolationError(error: any): boolean {
	// Check if the error is related to a foreign key violation on our user table
	return (
		error.code === 'P2003' &&
		error.meta?.field_name?.includes('Watch_discordUserId_fkey')
	);
}
