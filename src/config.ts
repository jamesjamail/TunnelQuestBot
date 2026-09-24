import { z } from 'zod';
import { Server } from './prisma/client';
import { resolveSqliteUrl } from './prisma/sqlite-url';

//	Every environment variable the bot reads, validated once at startup.
//
//	The point is the failure mode. Before this module a missing variable
//	surfaced as `undefined` deep inside whatever first happened to need it -
//	a URL built as "undefinedItem_Name.png", a channel fetch against the id
//	`undefined`, a watch duration of NaN days. Those are all silent for a while
//	and then wrong. Parsing here turns them into one message, at boot, naming
//	every variable that is missing or malformed rather than only the first.

//	`SERVERS_<NAME>_...` variables are keyed off the Prisma Server enum, so
//	adding a server to the schema adds its optional configuration group
//	automatically. A complete group enables that server.
export const SERVER_NAMES = Object.keys(Server) as (keyof typeof Server)[];

//	Generic and `as const` so the results are literal key types rather than
//	`string`. That is what lets callers index Config without an index signature,
//	and so what keeps a typo in a fixed key a compile error.
export const serverEnvKeys = <S extends keyof typeof Server>(server: S) =>
	({
		logFile: `SERVERS_${server}_LOG_FILE_PATH`,
		classicChannel: `SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID`,
		embeddedChannel: `SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID`,
	}) as const;

//	Presence is enforced; shape is not. Discord ids are 17-20 digit snowflakes,
//	but asserting that here would reject the symbolic ids the test suite uses as
//	channel keys. `doctor` warns about non-snowflake ids instead, which covers
//	the setup mistake (pasting a channel *name*) without coupling the schema to
//	fixture shapes.
const channelId = z.string().min(1);
const optionalNonemptyString = z.preprocess(
	(value) => (value === '' ? undefined : value),
	z.string().min(1).optional(),
);

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
	//	`.default()` only fires on undefined, so a key left blank in .env - a
	//	normal thing to find - coerced to 0 and failed .positive(), reported as
	//	"expected number to be >0" rather than falling back to 7.
	WATCH_DURATION_IN_DAYS: z.preprocess(
		(value) => (value === '' ? undefined : value),
		z.coerce.number().int().positive().default(7),
	),

	// Database validation is independent of Discord configuration and I/O.
	DATABASE_URL: z.string().refine(
		(value) => {
			try {
				resolveSqliteUrl(value);
				return true;
			} catch {
				return false;
			}
		},
		{
			message:
				'must be a local SQLite file URL, such as file:./data/tunnelquestbot.db; use POSTGRES_MIGRATION_URL to import PostgreSQL data',
		},
	),
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
		shape[keys.logFile] = optionalNonemptyString;
		shape[keys.classicChannel] = optionalNonemptyString;
		shape[keys.embeddedChannel] = optionalNonemptyString;
	}

	return z.object(shape);
}

//	Derived from the schema rather than restated. The hand-written version could
//	drift silently - changing WATCH_DURATION_IN_DAYS in the schema left the type
//	still claiming `number` with no error anywhere.
type ServerName = keyof typeof Server;

//	The dynamic `SERVERS_<NAME>_*` keys still need to be in the type, but as a
//	template-literal union rather than `Record<string, unknown>`. That index
//	signature made `config().TYPOED_KEY` compile and return undefined, which is
//	the exact failure this module exists to eliminate.
type ServerConfig = {
	[K in `SERVERS_${ServerName}_LOG_FILE_PATH`]?: string;
} & {
	[K in
		| `SERVERS_${ServerName}_STREAM_CHANNEL_CLASSIC_ID`
		| `SERVERS_${ServerName}_STREAM_CHANNEL_EMBEDDED_ID`]?: string;
};

export type Config = z.infer<z.ZodObject<typeof baseSchema>> & ServerConfig;

export class ConfigError extends Error {
	//	assigned in the body rather than as a parameter property: parameter
	//	properties emit runtime code and so are barred by erasableSyntaxOnly
	readonly problems: string[];

	constructor(problems: string[], hint?: string) {
		super(
			[
				`Configuration is invalid (${problems.length} problem${
					problems.length === 1 ? '' : 's'
				}):`,
				'',
				...problems.map((problem) => `  - ${problem}`),
				'',
				//	a hint explains why a problem may not be a problem; the generic
				//	advice below is not useful when one applies
				hint ??
					[
						'Copy .env.example to .env and fill in the missing values.',
						'`npm run setup` can create the Discord channels and fill in',
						'their ids for you.',
					].join('\n'),
			].join('\n'),
		);
		this.problems = problems;
		this.name = 'ConfigError';
	}
}

export function enabledServers(parsed: Config = config()): Server[] {
	return SERVER_NAMES.filter((server) => {
		const keys = serverEnvKeys(server);
		return Boolean(
			parsed[keys.classicChannel] &&
				parsed[keys.embeddedChannel] &&
				(parsed.FAKE_LOGS || parsed[keys.logFile]),
		);
	}) as Server[];
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

	//	A server is disabled when both of its Discord channel ids are absent.
	//	Compose may still derive a legacy log path for every enum value, so a path
	//	alone is not evidence that the operator intended to enable that server.
	//	Once either channel is present, require the complete section so a typo
	//	does not silently disable an intended server. Fake logs supply paths.
	const serverProblems: string[] = [];
	for (const server of SERVER_NAMES) {
		const keys = serverEnvKeys(server);
		const provided = Boolean(
			parsed[keys.classicChannel] || parsed[keys.embeddedChannel],
		);
		if (!provided) continue;

		const required = [
			...(parsed.FAKE_LOGS ? [] : [keys.logFile]),
			keys.classicChannel,
			keys.embeddedChannel,
		];
		for (const key of required) {
			if (!parsed[key]) {
				serverProblems.push(
					`${key} is not set (${server} is partially configured)`,
				);
			}
		}
	}

	if (serverProblems.length > 0) {
		throw new ConfigError(serverProblems.sort());
	}

	if (enabledServers(parsed).length === 0) {
		throw new ConfigError([
			'No auction servers are configured; configure at least one complete SERVERS_<NAME> section',
		]);
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
