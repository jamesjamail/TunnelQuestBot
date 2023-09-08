/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { color } from '../functions';

const prisma = new PrismaClient();

module.exports = async () => {
	const DATABASE_URL = process.env.DATABASE_URL;

	if (!DATABASE_URL) {
		return console.log(
			color(
				'text',
				`🔷 Prisma database URL not found, ${color(
					'error',
					'skipping.',
				)}`,
			),
		);
	}

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
				`🔷 Prisma connection has been ${color('error', 'failed.')}`,
			),
		);
	}
};
