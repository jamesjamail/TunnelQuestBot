import { createSqliteAdapter } from './sqlite';
import { PrismaClient } from './client';
import { color } from '../functions';
import { gracefullyHandleError } from '../lib/helpers/errors';

const DATABASE_URL = process.env.DATABASE_URL;

// The adapter opens the local database when Prisma first connects.
export const prisma = new PrismaClient({
	adapter: createSqliteAdapter(
		DATABASE_URL ?? 'file:./data/tunnelquestbot.db',
	),
});

export async function initializePrisma() {
	if (!DATABASE_URL) {
		console.log(
			color(
				'text',
				`🔷 Prisma database URL not found, ${color(
					'error',
					'skipping.',
				)}`,
			),
		);
	} else {
		try {
			await prisma.$connect(); // try to establish a connection
			console.log(
				color(
					'text',
					`🔷 Prisma connection has been ${color(
						'variable',
						'established.',
					)}`,
				),
			);
		} catch (error) {
			await gracefullyHandleError(error);
			console.log(
				color(
					'text',
					`🔷 Prisma connection has been ${color(
						'error',
						'failed.',
					)}`,
				),
			);
		}
	}
}
