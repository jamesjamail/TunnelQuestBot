import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import {
	CHANNEL_ID_KEYS,
	ConfigError,
	SNOWFLAKE_PATTERN,
	parseConfig,
	serverEnvKeys,
} from './config';
//	Imported for its side effect as much as its value: this pulls in the game
//	data JSON and the generated Prisma client, both of which the Dockerfile
//	copies into the runtime image through a hand-maintained list of paths. If
//	that list falls behind, the image still builds and this is what notices.
import { consolidatedItemsAndAliases } from './lib/gameData/consolidatedItems';
import { Server } from './prisma/client';

//	Validates configuration and exits. Deliberately does not connect to Discord,
//	Postgres or Redis, so it answers "is this environment set up correctly?"
//	without needing a bot token that works or a database that is up.
//
//	Two callers depend on that: a contributor checking their .env before the
//	first run, and the compose smoke test in CI, which has neither a real token
//	nor a reachable Discord.

expand(config());

function main(): number {
	let parsed: ReturnType<typeof parseConfig>;

	try {
		parsed = parseConfig();
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(error.message);
			return 1;
		}
		throw error;
	}

	const servers = Object.keys(Server) as (keyof typeof Server)[];

	//	The schema only checks these are present. A value that is not a snowflake
	//	is almost always a channel *name* pasted where an id belongs, which
	//	otherwise fails much later as a confusing "unknown channel" from Discord.
	const channelKeys = [
		...CHANNEL_ID_KEYS,
		...servers.flatMap((server) => [
			serverEnvKeys(server).classicChannel,
			serverEnvKeys(server).embeddedChannel,
		]),
	];

	const suspicious = channelKeys.filter((key) => {
		const value = parsed[key];
		return typeof value === 'string' && !SNOWFLAKE_PATTERN.test(value);
	});

	if (suspicious.length > 0) {
		console.warn('Warning: these do not look like Discord ids:\n');
		for (const key of suspicious) {
			console.warn(`  - ${key} = ${String(parsed[key])}`);
		}
		console.warn(
			'\nDiscord ids are 17-20 digits. Enable Developer Mode in Discord,',
		);
		console.warn('then right-click a channel and "Copy Channel ID".\n');
	}

	console.log('Configuration OK\n');
	console.log(`  servers          ${servers.join(', ')}`);
	console.log(
		`  log source       ${
			parsed.FAKE_LOGS
				? 'generated (FAKE_LOGS=true)'
				: servers
						.map((server) => parsed[serverEnvKeys(server).logFile])
						.join(', ')
		}`,
	);
	console.log(`  watch duration   ${parsed.WATCH_DURATION_IN_DAYS} days`);
	console.log(`  wiki             ${parsed.WIKI_BASE_URL}`);
	console.log(`  pricing api      ${parsed.HISTORICAL_AUCTION_DATA_API}`);
	console.log(
		`  redis            ${parsed.REDIS_URL ?? `socket in ${parsed.REDIS_SOCKET_DIR ?? '/tmp'}`}`,
	);
	console.log(`  debug mode       ${parsed.DEBUG_MODE}`);

	const itemCount = Object.keys(consolidatedItemsAndAliases).length;
	console.log(`  game data        ${itemCount} items and aliases loaded`);

	if (itemCount === 0) {
		console.error(
			'\nGame data is empty. In a container this means the JSON under',
		);
		console.error('src/lib/gameData was not copied into the image.');
		return 1;
	}

	return 0;
}

process.exit(main());
