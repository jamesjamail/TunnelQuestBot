/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Interaction } from 'discord.js';
import { createUser } from './dbExecutors';

//  users table PK is discord user id. feels like a waste to look it up everytime
//  when they only need to be created once.  let's assume they exist and catch the
//  the specific error if it fails, then create the user and try again.

//  this is not meaningful everywhere, as often we are upserting or need data from the user table
//  but when that's not the case, let's use this.
export async function ensureUserExistsAndExecute(
	interaction: Interaction,
	action: () => Promise<any>,
): Promise<any> {
	try {
		return await action();
	} catch (error) {
		console.log('error = ', error);

		if (isForeignKeyViolationError(error)) {
			console.log('isFkViolation');
			await createUser(interaction.user).catch(console.error);
			return await action();
		}
		throw error; // If it's not the foreign key error we're expecting, re-throw it
	}
}

function isForeignKeyViolationError(error: any): boolean {
	// Check if the error is related to a foreign key violation
	// You might need to refine this condition based on the exact error message or code Prisma throws for a FK violation
	return (
		error.code === 'P2003' && error.meta?.target?.includes('discordUserId')
	);
}
