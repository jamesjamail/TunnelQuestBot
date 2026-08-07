import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './client';
import { color } from '../functions';
import { gracefullyHandleError } from '../lib/helpers/errors';

const DATABASE_URL = process.env.DATABASE_URL;

//	Prisma 7 requires a driver adapter. Neither the adapter nor the pool it wraps
//	opens a connection here, so a missing DATABASE_URL stays a soft failure that
//	initializePrisma reports below.
export const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: DATABASE_URL }),
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
