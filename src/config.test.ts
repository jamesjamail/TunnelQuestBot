import { describe, it, expect } from 'vitest';
import { ConfigError, parseConfig, serverEnvKeys } from './config';

//	A complete, valid environment. Individual cases start from this and remove or
//	corrupt one thing, so a failure names exactly what was changed.
function validEnv(overrides: Record<string, string | undefined> = {}) {
	const env: Record<string, string | undefined> = {
		TOKEN: 'a-token',
		CLIENT_ID: '123456789012345678',
		COMMAND_CHANNEL: '123456789012345678',
		FEEDBACK_AND_IDEAS_CHANNEL: '123456789012345678',
		ERROR_LOG_CHANNEL_ID: '123456789012345678',
		IMAGE_BUCKET_URL: 'https://img.example.com/',
		WIKI_BASE_URL: 'https://wiki.example.com/',
		HISTORICAL_AUCTION_DATA_API: 'https://pricing.example.com',
		DATABASE_URL: 'postgresql://user@localhost/db',
		FAKE_LOGS: 'true',
	};

	for (const server of ['BLUE', 'GREEN', 'RED']) {
		env[serverEnvKeys(server as 'BLUE').classicChannel] = `${server}-c`;
		env[serverEnvKeys(server as 'BLUE').embeddedChannel] = `${server}-e`;
	}

	return { ...env, ...overrides } as NodeJS.ProcessEnv;
}

describe('parseConfig', () => {
	it('accepts a complete environment', () => {
		const parsed = parseConfig(validEnv());
		expect(parsed.TOKEN).toBe('a-token');
		expect(parsed.WATCH_DURATION_IN_DAYS).toBe(7);
	});

	it('reports every problem at once rather than only the first', () => {
		//	this is the whole point of the module: fixing .env one restart per
		//	error is the most tedious part of first-time setup
		let error: ConfigError | undefined;
		try {
			parseConfig(
				validEnv({
					TOKEN: undefined,
					COMMAND_CHANNEL: undefined,
					WIKI_BASE_URL: undefined,
				}),
			);
		} catch (thrown) {
			error = thrown as ConfigError;
		}

		expect(error).toBeInstanceOf(ConfigError);
		expect(error?.problems).toHaveLength(3);
		expect(error?.message).toContain('TOKEN is not set');
		expect(error?.message).toContain('COMMAND_CHANNEL is not set');
		expect(error?.message).toContain('WIKI_BASE_URL is not set');
	});

	it('rejects a malformed url rather than only a missing one', () => {
		expect(() =>
			parseConfig(validEnv({ WIKI_BASE_URL: 'wiki.example' })),
		).toThrow(/WIKI_BASE_URL/);
	});

	it('defaults the watch duration and coerces it from a string', () => {
		expect(parseConfig(validEnv()).WATCH_DURATION_IN_DAYS).toBe(7);
		expect(
			parseConfig(validEnv({ WATCH_DURATION_IN_DAYS: '14' }))
				.WATCH_DURATION_IN_DAYS,
		).toBe(14);
	});

	it('rejects a non-positive watch duration', () => {
		expect(() =>
			parseConfig(validEnv({ WATCH_DURATION_IN_DAYS: '0' })),
		).toThrow(/WATCH_DURATION_IN_DAYS/);
	});

	it('reads booleans the way the rest of the codebase always has', () => {
		expect(parseConfig(validEnv({ DEBUG_MODE: 'true' })).DEBUG_MODE).toBe(
			true,
		);
		expect(parseConfig(validEnv({ DEBUG_MODE: 'T' })).DEBUG_MODE).toBe(
			true,
		);
		expect(parseConfig(validEnv({ DEBUG_MODE: 'false' })).DEBUG_MODE).toBe(
			false,
		);
		expect(
			parseConfig(validEnv({ DEBUG_MODE: undefined })).DEBUG_MODE,
		).toBe(false);
	});

	describe('log file paths', () => {
		it('are not required while FAKE_LOGS is on', () => {
			expect(() =>
				parseConfig(validEnv({ FAKE_LOGS: 'true' })),
			).not.toThrow();
		});

		it('are required once FAKE_LOGS is off, naming each server', () => {
			let error: ConfigError | undefined;
			try {
				parseConfig(validEnv({ FAKE_LOGS: 'false' }));
			} catch (thrown) {
				error = thrown as ConfigError;
			}

			expect(error).toBeInstanceOf(ConfigError);
			expect(error?.problems).toHaveLength(3);
			for (const server of ['BLUE', 'GREEN', 'RED']) {
				expect(error?.message).toContain(
					`SERVERS_${server}_LOG_FILE_PATH`,
				);
			}
		});

		it('pass once every server has one', () => {
			const withLogs: Record<string, string> = {};
			for (const server of ['BLUE', 'GREEN', 'RED']) {
				withLogs[`SERVERS_${server}_LOG_FILE_PATH`] =
					`/logs/${server}.txt`;
			}

			expect(() =>
				parseConfig(validEnv({ FAKE_LOGS: 'false', ...withLogs })),
			).not.toThrow();
		});
	});

	describe('per-server keys', () => {
		it('are derived from the Prisma Server enum', () => {
			//	adding a server to schema.prisma should add its required variables
			//	automatically, rather than failing the first time that server sees
			//	an auction
			expect(serverEnvKeys('BLUE')).toEqual({
				logFile: 'SERVERS_BLUE_LOG_FILE_PATH',
				classicChannel: 'SERVERS_BLUE_STREAM_CHANNEL_CLASSIC_ID',
				embeddedChannel: 'SERVERS_BLUE_STREAM_CHANNEL_EMBEDDED_ID',
			});
		});

		it('are all required', () => {
			expect(() =>
				parseConfig(
					validEnv({
						SERVERS_GREEN_STREAM_CHANNEL_EMBEDDED_ID: undefined,
					}),
				),
			).toThrow(/SERVERS_GREEN_STREAM_CHANNEL_EMBEDDED_ID is not set/);
		});
	});

	it('tells the reader how to fix the problem', () => {
		let error: ConfigError | undefined;
		try {
			parseConfig(validEnv({ TOKEN: undefined }));
		} catch (thrown) {
			error = thrown as ConfigError;
		}

		expect(error?.message).toContain('.env.example');
		expect(error?.message).toContain('npm run setup');
	});
});
