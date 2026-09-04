#!/usr/bin/env node
//	Creates the Discord channels the bot needs and writes their ids into .env.
//
//	Filling twelve channel ids in by hand is the hardest part of first-time
//	setup: each one means enabling Developer Mode, right-clicking the right
//	channel, and pasting a nineteen-digit number into the right line. This does
//	that instead.
//
//	  npm run setup -- <guild-id>
//	  npm run setup -- <guild-id> --dry-run    # print the plan, change nothing
//	  npm run setup -- <guild-id> --yes        # skip the confirmation prompt
//
//	Plain .mjs rather than TypeScript so it runs straight after `npm install`,
//	with no build step - this is the script someone reaches for before the
//	project works.
//
//	It talks to Discord over REST only. There is no gateway connection and no
//	slash-command registration, so running it cannot disturb a bot that is
//	already live.

import { renameSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';

//	Discord's numeric type for a normal text channel.
const GUILD_TEXT = 0;

//	Resolve against the repo rather than the cwd. Both reads below are of files
//	that live at a fixed place in the tree, so running this from a subdirectory
//	used to report "No .env found. Copy .env.example to .env first." - advice for
//	a problem the user did not have.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(repoRoot, '.env');

//	----------------------------------------------------------------------
//	Pure helpers, exported for the tests in setup.test.ts
//	----------------------------------------------------------------------

//	The Server enum is the single source of truth for which servers exist, and
//	is read from the schema rather than duplicated here. Parsed textually
//	because this script must work before `prisma generate` has ever run.
export function parseServerNames(schemaSource) {
	const match = schemaSource.match(/enum\s+Server\s*\{([^}]*)\}/);
	if (!match) {
		throw new Error('Could not find the Server enum in schema.prisma');
	}

	return match[1]
		.split('\n')
		.map((line) => line.replace(/\/\/.*$/, '').trim())
		.filter(Boolean);
}

//	Every channel the bot needs, as { envKey, channelName, description }.
export function requiredChannels(serverNames) {
	const perServer = serverNames.flatMap((server) => {
		const lower = server.toLowerCase();
		return [
			{
				envKey: `SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID`,
				channelName: `${lower}-tunnel-stream`,
				description: `${server}: raw auction lines`,
			},
			{
				envKey: `SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID`,
				channelName: `${lower}-tunnel-stream-embedded`,
				description: `${server}: auctions as rich embeds`,
			},
		];
	});

	return [
		...perServer,
		{
			envKey: 'COMMAND_CHANNEL',
			channelName: 'commands',
			description: 'where users run slash commands',
		},
		{
			envKey: 'FEEDBACK_AND_IDEAS_CHANNEL',
			channelName: 'feedback-and-ideas',
			description: 'linked from /help',
		},
		{
			envKey: 'ERROR_LOG_CHANNEL_ID',
			channelName: 'error-log',
			description: 'runtime errors and stack traces',
		},
	];
}

//	Decide what to do with each channel without touching anything. Three
//	outcomes: keep what .env already has, adopt a channel that already exists in
//	the guild, or create one.
export function planChannels({
	channels,
	env,
	existingChannels,
	force = false,
}) {
	const byName = new Map(
		existingChannels.map((channel) => [channel.name, channel]),
	);

	return channels.map((channel) => {
		const configured = env[channel.envKey];

		if (configured && !force) {
			return { ...channel, action: 'keep', id: configured };
		}

		//	previousId records an id that this entry would overwrite, which only
		//	happens under --force. The confirmation prompt reports it, since
		//	replacing a hand-picked id is not something to do unannounced.
		const existing = byName.get(channel.channelName);
		if (existing) {
			return {
				...channel,
				action: 'adopt',
				id: existing.id,
				previousId: configured || undefined,
			};
		}

		return {
			...channel,
			action: 'create',
			id: undefined,
			previousId: configured || undefined,
		};
	});
}

//	Rewrite .env in place: replace the value of a key that is already present,
//	append one that is not, and leave every comment, blank line and ordering
//	decision exactly as the author left it.
export function applyEnvUpdates(source, updates) {
	const lines = source.split('\n');
	const remaining = new Map(Object.entries(updates));

	//	Rewrite the *last* occurrence of a duplicated key, because that is the one
	//	that wins: parseEnvFile below and dotenv both let the last assignment
	//	stand. Updating the first would rewrite a line nobody reads and leave the
	//	stale value in effect, while reporting success.
	const lastIndex = new Map();
	lines.forEach((line, index) => {
		const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
		if (match && remaining.has(match[1])) lastIndex.set(match[1], index);
	});

	const rewritten = lines.map((line, index) => {
		const match = line.match(/^(\s*)([A-Z0-9_]+)(\s*)=/);
		if (!match) return line;

		const key = match[2];
		if (!remaining.has(key) || lastIndex.get(key) !== index) return line;

		const value = remaining.get(key);
		remaining.delete(key);
		return `${match[1]}${key}=${value}`;
	});

	if (remaining.size > 0) {
		//	trailing blank lines would otherwise push the additions away from the
		//	file body
		while (rewritten.length > 0 && rewritten.at(-1).trim() === '') {
			rewritten.pop();
		}

		rewritten.push('', '# Added by `npm run setup`');
		for (const [key, value] of remaining) {
			rewritten.push(`${key}=${value}`);
		}
	}

	return `${rewritten.join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * @param {string} source
 * @returns {Record<string, string>}
 */
export function parseEnvFile(source) {
	/** @type {Record<string, string>} */
	const env = {};
	for (const line of source.split('\n')) {
		const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
		if (!match) continue;
		env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
	}
	return env;
}

//	----------------------------------------------------------------------
//	IO
//	----------------------------------------------------------------------

function describePlan(plan) {
	const creating = plan.filter((entry) => entry.action === 'create');
	const adopting = plan.filter((entry) => entry.action === 'adopt');
	const keeping = plan.filter((entry) => entry.action === 'keep');

	if (creating.length > 0) {
		console.log(`\nWill CREATE ${creating.length} channel(s):`);
		for (const entry of creating) {
			console.log(
				`  #${entry.channelName.padEnd(32)} ${entry.description}`,
			);
		}
	}

	if (adopting.length > 0) {
		console.log(`\nWill USE ${adopting.length} existing channel(s):`);
		for (const entry of adopting) {
			console.log(`  #${entry.channelName.padEnd(32)} ${entry.id}`);
		}
	}

	if (keeping.length > 0) {
		console.log(
			`\nLeaving ${keeping.length} already configured in .env (--force to replace):`,
		);
		for (const entry of keeping) {
			console.log(`  ${entry.envKey.padEnd(42)} ${entry.id}`);
		}
	}
}

async function confirm(question) {
	//	Without a TTY there is nobody to answer, and readline resolves immediately
	//	on a closed stdin - which would read as "no" and abort a piped or CI run
	//	with no explanation. Say what to pass instead.
	if (!process.stdin.isTTY) {
		fail(
			`${question}\n\n` +
				'Nothing is attached to stdin, so this cannot be answered here.\n' +
				'Re-run with --yes to confirm up front, or --dry-run to see the plan.',
		);
	}

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	try {
		const answer = await rl.question(`\n${question} [y/N] `);
		return /^y(es)?$/i.test(answer.trim());
	} finally {
		rl.close();
	}
}

function fail(message) {
	console.error(`\n${message}`);
	process.exit(1);
}

async function main() {
	const args = process.argv.slice(2);
	const flags = new Set(args.filter((arg) => arg.startsWith('--')));
	const guildId = args.find((arg) => !arg.startsWith('--'));

	const dryRun = flags.has('--dry-run');
	const force = flags.has('--force');
	const assumeYes = flags.has('--yes');

	const envSource = (() => {
		try {
			return readFileSync(envPath, 'utf8');
		} catch {
			fail('No .env found. Copy .env.example to .env first.');
		}
	})();

	const env = parseEnvFile(envSource);
	const token = process.env.TOKEN || env.TOKEN;

	if (!token) {
		fail(
			'TOKEN is not set in .env.\n' +
				'Create an application at https://discord.com/developers/applications,\n' +
				'add a bot, and copy its token into .env.',
		);
	}

	if (!guildId) {
		fail(
			'Usage: npm run setup -- <guild-id> [--dry-run] [--yes] [--force]\n\n' +
				'The guild id is your Discord server. Enable Developer Mode\n' +
				'(Settings -> Advanced), then right-click the server and\n' +
				'"Copy Server ID".',
		);
	}

	if (!/^\d{17,20}$/.test(guildId)) {
		fail(
			`"${guildId}" does not look like a guild id.\n` +
				'Discord ids are 17-20 digits. You may have copied a channel name\n' +
				'or an invite link instead of the server id.',
		);
	}

	const serverNames = parseServerNames(
		readFileSync(join(repoRoot, 'src', 'prisma', 'schema.prisma'), 'utf8'),
	);
	const channels = requiredChannels(serverNames);
	const rest = new REST({ version: '10' }).setToken(token);

	let existingChannels;
	try {
		existingChannels = await rest.get(Routes.guildChannels(guildId));
	} catch (error) {
		if (error.status === 401) {
			fail('Discord rejected the token in .env (401 Unauthorized).');
		}
		//	Only an HTTP response earns the guild-id advice below. A DNS failure, a
		//	proxy, TLS interception or a plain TypeError from a future edit all
		//	arrive here too, and rendering those as `HTTP ?` followed by three
		//	bullets about server ids is advice for a problem the user does not
		//	have. Re-throw so main().catch prints the real thing.
		if (typeof error?.status !== 'number') throw error;
		//	403 and 404 both mean "not your guild" from here. Discord also answers
		//	503 for an id that is well-formed but is not a guild at all - passing
		//	a channel id is the usual way to get there - so the advice is the same
		//	for anything that is not a clean success.
		fail(
			`Could not read channels in guild ${guildId} (HTTP ${
				error.status ?? '?'
			}).\n\n` +
				'Check that:\n' +
				'  - the id is a *server* id, not a channel id. Right-click the\n' +
				'    server name, not a channel, and pick "Copy Server ID".\n' +
				'  - the bot has been invited to that server.\n' +
				'  - it has the Manage Channels permission.\n\n' +
				`Discord said: ${error.message}`,
		);
	}

	const plan = planChannels({
		channels,
		env,
		existingChannels: existingChannels.filter(
			(channel) => channel.type === GUILD_TEXT,
		),
		force,
	});

	console.log(`Guild:   ${guildId}`);
	console.log(`Servers: ${serverNames.join(', ')} (from schema.prisma)`);
	describePlan(plan);

	const creating = plan.filter((entry) => entry.action === 'create');
	const writes = plan.filter((entry) => entry.action !== 'keep');

	if (writes.length === 0) {
		console.log('\nNothing to do; .env is already complete.');
		return;
	}

	if (dryRun) {
		console.log('\n--dry-run: nothing was created or written.');
		return;
	}

	//	Ask before any of it. Creating channels is the obvious one, but the write
	//	to .env deserves the same gate: adopting by name rewrites .env with no
	//	creates at all, and --force replaces ids that may have been hand-picked,
	//	which is the most regrettable thing this script can do.
	if (!assumeYes) {
		const overwriting = plan.filter(
			(entry) => entry.action !== 'keep' && entry.previousId,
		);
		const actions = [];
		if (creating.length > 0) {
			actions.push(
				`create ${creating.length} channel(s) in guild ${guildId}`,
			);
		}
		if (overwriting.length > 0) {
			actions.push(
				`replace ${overwriting.length} existing id(s) in .env`,
			);
		}
		actions.push(
			`write ${writes.length} id(s) to ${envPath.replace(`${repoRoot}/`, '')}`,
		);

		const proceed = await confirm(
			`This will ${actions.join(', ')}. Proceed?`,
		);
		if (!proceed) {
			console.log('Aborted; nothing was created or written.');
			return;
		}
	}

	for (const entry of creating) {
		try {
			const created = await rest.post(Routes.guildChannels(guildId), {
				body: { name: entry.channelName, type: GUILD_TEXT },
				reason: 'TunnelQuestBot setup',
			});
			entry.id = created.id;
			console.log(`  created #${entry.channelName} -> ${created.id}`);
		} catch (error) {
			if (error.status === 403) {
				fail(
					`The bot lacks permission to create channels in guild ${guildId}.\n` +
						'Grant it Manage Channels and run this again. Channels created\n' +
						'before this point are kept, and re-running will adopt them.',
				);
			}
			throw error;
		}
	}

	const updates = Object.fromEntries(
		writes.map((entry) => [entry.envKey, entry.id]),
	);
	//	Write through a temp file in the same directory and rename over the
	//	original. .env holds the only copy of the bot token, and a crash midway
	//	through a plain write truncates it.
	const tmpPath = `${envPath}.setup-${process.pid}`;
	writeFileSync(tmpPath, applyEnvUpdates(envSource, updates));
	renameSync(tmpPath, envPath);

	console.log(`\nWrote ${Object.keys(updates).length} id(s) to .env.`);
	console.log(
		'Run `npm run doctor` to confirm the configuration is complete.',
	);
}

//	Only run when executed directly, so the tests can import the helpers above.
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
