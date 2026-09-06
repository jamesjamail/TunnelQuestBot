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
import type { SlashCommand } from './types';
import { registerCommandHandlers } from './handlers/Command';
import { registerEventHandlers } from './handlers/Event';
import { config as loadDotenv } from 'dotenv';
import { expand } from 'dotenv-expand';
import { ConfigError, config as appConfig } from './config';
import {
	gracefullyHandleError,
	handleFatalError,
	normalizeError,
} from './lib/helpers/errors';
//	DATABASE_URL is composed from POSTGRES_* and DB_SOCKET_DIR, and Prisma 7 no
//	longer expands those references for us.
expand(loadDotenv());

let handlingFatalException = false;

client.slashCommands = new Collection<string, SlashCommand>();
client.cooldowns = new Collection<string, number>();

// 	Everything below is startup, and runs only when this module is the process
// 	entrypoint. Six modules import `client` from here - errors.ts among them, so
// 	the reach is effectively the whole codebase - and importing any of them used
// 	to register slash commands against the live application and open a gateway
// 	connection as a side effect. That made the bot impossible to load from a
// 	script, and `doctor` in particular could not touch the handler directories
// 	without logging in with the production token.
function boot(): void {
	// 	Validate the whole environment before doing anything else. Every consumer
	// 	reads through config(), which memoises this first call, so a bad .env fails
	// 	here with the full list of problems rather than surfacing later as an
	// 	`undefined` interpolated into a URL or a channel id.
	//
	// 	Inside boot() rather than at module scope: this calls process.exit(1), and
	// 	at module scope any consumer reaching errors.ts -> index.ts with an
	// 	incomplete environment terminated just by importing it.
	try {
		appConfig();
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(error.message);
			process.exit(1);
		}
		throw error;
	}

	// 	The bot talks to Discord, Postgres and Redis constantly, and any of them
	// 	can fail transiently. Without these handlers Node terminates the process
	// 	on the first stray rejection, which under `restart: always` turns a blip
	// 	into a restart loop that drops log monitoring for every server.
	//
	// 	Also startup-only: installing global process handlers is a side effect no
	// 	importer asked for.
	process.on('unhandledRejection', (reason) => {
		void gracefullyHandleError(reason);
	});

	process.on('uncaughtException', (error) => {
		if (handlingFatalException) return;
		handlingFatalException = true;
		void handleFatalError(error);
	});

	// 	Called explicitly rather than scanned from handlers/: the scan also invoked
	// 	the loader modules, which export named functions instead of a callable, and
	// 	the resulting throw skipped the login() call below. Imported rather than
	// 	require()d so a rename of either handler fails the build instead of at boot.
	registerCommandHandlers(client);
	registerEventHandlers(client);

	login().catch((error) => {
		console.error('Could not log in to Discord: ', normalizeError(error));
		process.exit(1);
	});
}

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
			await client.login(appConfig().TOKEN);
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

if (require.main === module) {
	boot();
}
