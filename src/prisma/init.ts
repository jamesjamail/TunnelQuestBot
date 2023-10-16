/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { color } from '../functions';

export const prisma = new PrismaClient();

const DATABASE_URL = process.env.DATABASE_URL;

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
