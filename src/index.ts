import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
const { Guilds, MessageContent, GuildMessages, GuildMembers, DirectMessages } =
	GatewayIntentBits;
export const client = new Client({
	intents: [
		Guilds,
		MessageContent,
		GuildMessages,
		GuildMembers,
		DirectMessages,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction], //	needed for handling interactions from DM's
});
import { SlashCommand } from './types';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import { gracefullyHandleError, normalizeError } from './lib/helpers/errors';
config();

// 	The bot talks to Discord, Postgres and Redis constantly, and any of them can
// 	fail transiently. Without these handlers Node terminates the process on the
// 	first stray rejection, which under `restart: always` turns a blip into a
// 	restart loop that drops log monitoring for every server.
process.on('unhandledRejection', (reason) => {
	void gracefullyHandleError(reason);
});

process.on('uncaughtException', (error) => {
	void gracefullyHandleError(error);
});

client.slashCommands = new Collection<string, SlashCommand>();
client.cooldowns = new Collection<string, number>();

const handlersDir = join(__dirname, './handlers');
readdirSync(handlersDir).forEach((handler) => {
	if (!handler.endsWith('.js')) return;

	require(`${handlersDir}/${handler}`)(client);
});

// 	Once logged in discord.js reconnects on its own, but a failure during the
// 	initial login is fatal. On container start we frequently lose the race with
// 	Docker's DNS, so retry rather than exiting into a restart loop.
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_LOGIN_BACKOFF_MS = 30_000;

// 	no amount of retrying fixes a bad token
const UNRECOVERABLE_LOGIN_CODES = ['TokenInvalid', 'TokenMissing'];

async function login() {
	for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
		try {
			await client.login(process.env.TOKEN);
			return;
		} catch (error) {
			const { code } = error as { code?: string };
			if (code && UNRECOVERABLE_LOGIN_CODES.includes(code)) {
				throw error;
			}

			if (attempt === MAX_LOGIN_ATTEMPTS) {
				throw error;
			}

			const backoff = Math.min(
				MAX_LOGIN_BACKOFF_MS,
				2 ** (attempt - 1) * 1000,
			);
			console.warn(
				`Discord login attempt ${attempt}/${MAX_LOGIN_ATTEMPTS} failed (${
					normalizeError(error).message
				}). Retrying in ${backoff}ms.`,
			);
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}
	}
}

login().catch((error) => {
	console.error('Could not log in to Discord: ', normalizeError(error));
	process.exit(1);
});
