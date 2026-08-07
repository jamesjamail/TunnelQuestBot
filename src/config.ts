import { z } from 'zod';
import { Server } from './prisma/client';

//	Every environment variable the bot reads, validated once at startup.
//
//	The point is the failure mode. Before this module a missing variable
//	surfaced as `undefined` deep inside whatever first happened to need it -
//	a URL built as "undefinedItem_Name.png", a channel fetch against the id
//	`undefined`, a watch duration of NaN days. Those are all silent for a while
//	and then wrong. Parsing here turns them into one message, at boot, naming
//	every variable that is missing or malformed rather than only the first.

//	`SERVERS_<NAME>_...` variables are keyed off the Prisma Server enum, so
//	adding a server to the schema adds its required variables automatically
//	rather than failing at runtime the first time that server sees an auction.
const SERVER_NAMES = Object.keys(Server) as (keyof typeof Server)[];

export const serverEnvKeys = (server: keyof typeof Server) => ({
	logFile: `SERVERS_${server}_LOG_FILE_PATH`,
	classicChannel: `SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID`,
	embeddedChannel: `SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID`,
});

//	Presence is enforced; shape is not. Discord ids are 17-20 digit snowflakes,
//	but asserting that here would reject the symbolic ids the test suite uses as
//	channel keys. `doctor` warns about non-snowflake ids instead, which covers
//	the setup mistake (pasting a channel *name*) without coupling the schema to
//	fixture shapes.
const channelId = z.string().min(1);

export const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export const CHANNEL_ID_KEYS = [
	'CLIENT_ID',
	'COMMAND_CHANNEL',
	'FEEDBACK_AND_IDEAS_CHANNEL',
	'ERROR_LOG_CHANNEL_ID',
] as const;

const url = z.url();

//	Booleans in .env are written as `true`/`false`, and the existing code reads
//	them with /^[tT]/, so accept the same spellings rather than tightening.
const envBoolean = z
	.string()
	.optional()
	.transform((value) => /^[tT]/.test(value ?? ''));

const baseSchema = {
	//	Discord
	TOKEN: z.string().min(1, 'required - see README for how to get one'),
	CLIENT_ID: channelId,
	COMMAND_CHANNEL: channelId,
	FEEDBACK_AND_IDEAS_CHANNEL: channelId,
	ERROR_LOG_CHANNEL_ID: channelId,

	//	External services
	IMAGE_BUCKET_URL: url,
	WIKI_BASE_URL: url,
	HISTORICAL_AUCTION_DATA_API: url,

	//	Behaviour
	WATCH_DURATION_IN_DAYS: z.coerce.number().int().positive().default(7),

	//	Infrastructure. DATABASE_URL is composed from POSTGRES_* in .env; by the
	//	time this runs dotenv-expand has already resolved it.
	//
	//	Note that src/prisma/init.ts and src/redis/init.ts deliberately read these
	//	from process.env rather than through config(). They are connection
	//	bootstraps that must work independently of a complete application
	//	environment - the integration suite points them at testcontainers without
	//	supplying any Discord configuration. They are validated here so `doctor`
	//	still reports on them.
	DATABASE_URL: z.string().min(1),
	REDIS_URL: z.string().optional(),
	REDIS_SOCKET_DIR: z.string().optional(),

	//	Development toggles
	FAKE_LOGS: envBoolean,
	DEBUG_MODE: envBoolean,
};

//	Log file paths are only required when actually tailing real logs. With
//	FAKE_LOGS the parser reads from a generated file instead, so demanding them
//	would make the no-EverQuest-client path impossible to start.
function buildSchema() {
	const shape: Record<string, z.ZodTypeAny> = { ...baseSchema };

	for (const server of SERVER_NAMES) {
		const keys = serverEnvKeys(server);
		shape[keys.logFile] = z.string().optional();
		shape[keys.classicChannel] = channelId;
		shape[keys.embeddedChannel] = channelId;
	}

	return z.object(shape);
}

export type Config = {
	TOKEN: string;
	CLIENT_ID: string;
	COMMAND_CHANNEL: string;
	FEEDBACK_AND_IDEAS_CHANNEL: string;
	ERROR_LOG_CHANNEL_ID: string;
	IMAGE_BUCKET_URL: string;
	WIKI_BASE_URL: string;
	HISTORICAL_AUCTION_DATA_API: string;
	WATCH_DURATION_IN_DAYS: number;
	DATABASE_URL: string;
	REDIS_URL?: string;
	REDIS_SOCKET_DIR?: string;
	FAKE_LOGS: boolean;
	DEBUG_MODE: boolean;
} & Record<string, unknown>;

export class ConfigError extends Error {
	//	assigned in the body rather than as a parameter property: parameter
	//	properties emit runtime code and so are barred by erasableSyntaxOnly
	readonly problems: string[];

	constructor(problems: string[]) {
		super(
			[
				`Configuration is invalid (${problems.length} problem${
					problems.length === 1 ? '' : 's'
				}):`,
				'',
				...problems.map((problem) => `  - ${problem}`),
				'',
				'Copy .env.example to .env and fill in the missing values.',
				'`npm run setup` can create the Discord channels and fill in',
				'their ids for you.',
			].join('\n'),
		);
		this.problems = problems;
		this.name = 'ConfigError';
	}
}

export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const result = buildSchema().safeParse(env);

	if (!result.success) {
		//	Report every problem at once. Fixing .env one error per restart is
		//	the single most tedious part of first-time setup.
		const problems = result.error.issues.map((issue) => {
			const key = issue.path.join('.');
			return issue.code === 'invalid_type' &&
				(env[key] === undefined || env[key] === '')
				? `${key} is not set`
				: `${key}: ${issue.message}`;
		});

		throw new ConfigError(problems.sort());
	}

	const parsed = result.data as Config;

	//	Checked after parsing rather than as a schema refinement so the message
	//	can name the specific servers, and so it does not fire while FAKE_LOGS
	//	is on.
	if (!parsed.FAKE_LOGS) {
		const missing = SERVER_NAMES.filter(
			(server) => !parsed[serverEnvKeys(server).logFile],
		);

		if (missing.length > 0) {
			throw new ConfigError(
				missing.map(
					(server) =>
						`${serverEnvKeys(server).logFile} is not set (required unless FAKE_LOGS=true)`,
				),
			);
		}
	}

	return parsed;
}

let cached: Config | undefined;

//	Lazy so that importing a module for a unit test does not require a full
//	environment, and memoised so the schema is only built once.
export function config(): Config {
	cached ??= parseConfig();
	return cached;
}

//	Tests mutate process.env between cases; this lets them drop the memo.
export function resetConfigCache(): void {
	cached = undefined;
}
