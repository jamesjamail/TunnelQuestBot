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

//	A URL is "resolved" when every part .env interpolates into it is present:
//	a user, a database name, and either a TCP host or a socket directory.
function isResolvedPostgresUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}

	if (!['postgresql:', 'postgres:'].includes(url.protocol)) return false;
	if (url.username === '') return false;
	if (url.pathname.replace(/^\//, '') === '') return false;

	//	`?host=` carries the unix socket directory the compose stack uses; without
	//	it the hostname has to be a real one.
	const socketDir = url.searchParams.get('host');
	return socketDir !== null ? socketDir !== '' : url.hostname !== '';
}

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

	//	Infrastructure. DATABASE_URL is composed from POSTGRES_* in .env; by the
	//	time this runs dotenv-expand has already resolved it.
	//
	//	Note that src/prisma/init.ts and src/redis/init.ts deliberately read these
	//	from process.env rather than through config(). They are connection
	//	bootstraps that must work independently of a complete application
	//	environment - the integration suite points them at testcontainers without
	//	supplying any Discord configuration. They are validated here so `doctor`
	//	still reports on them.
	//	Assembled from POSTGRES_* by dotenv-expand, so the interesting failure is
	//	a missing part rather than a missing value: expansion of an unset variable
	//	yields `postgresql://:@localhost/?host=`, which is non-empty and a valid
	//	URL, and used to pass. It resurfaced later as a connection error, which is
	//	the deferred failure this module exists to end.
	DATABASE_URL: z
		.string()
		.min(1)
		.refine(isResolvedPostgresUrl, {
			message:
				'looks unresolved - check POSTGRES_USER, POSTGRES_PASSWORD, ' +
				'POSTGRES_DB and DB_SOCKET_DIR are all set',
		}),
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
		| `SERVERS_${ServerName}_STREAM_CHANNEL_EMBEDDED_ID`]: string;
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
				//	These are normally absent from .env on purpose: compose derives
				//	them from LOG_SOURCE_PATH and injects them into the container.
				//	Seeing them on the host usually means doctor was run against a
				//	container-shaped .env, not that anything is broken.
				'docker-compose sets these from LOG_SOURCE_PATH, so they are absent\nfrom .env by design. For development on your host use FAKE_LOGS=true,\nwhich `npm run dev` does for you.',
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
