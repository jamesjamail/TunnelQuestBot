import type { Client } from 'discord.js';
import type { BotEvent } from '../types';
import { color } from '../functions';
import { startLoggingAllServers } from '../lib/parser';
import { initializePrisma } from '../prisma/init';
import { gracefullyHandleError } from '../lib/helpers/errors';

const MAX_STARTUP_BACKOFF_MS = 30_000;

type StartupOptions = {
	maxAttempts?: number;
	sleep?: (delayMs: number) => Promise<void>;
};

export async function initializeRuntime({
	maxAttempts = Number.POSITIVE_INFINITY,
	sleep = (delayMs) =>
		new Promise((resolve) => {
			setTimeout(resolve, delayMs);
		}),
}: StartupOptions = {}): Promise<void> {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			await initializePrisma();
			await startLoggingAllServers();
			return;
		} catch (error) {
			await gracefullyHandleError(error);
			if (attempt >= maxAttempts) {
				throw error;
			}

			const backoff = Math.min(
				MAX_STARTUP_BACKOFF_MS,
				2 ** (attempt - 1) * 1000,
			);
			console.warn(
				`Runtime initialization attempt ${attempt} failed. Retrying in ${backoff}ms.`,
			);
			await sleep(backoff);
		}
	}
}

const event: BotEvent = {
	name: 'clientReady',
	once: true,
	execute: async (client: Client) => {
		console.log(
			color(
				'text',
				`💪 Logged in as ${color(
					'variable',
					client.user?.tag as string,
				)}`,
			),
		);
		await initializeRuntime();
	},
};

export default event;
