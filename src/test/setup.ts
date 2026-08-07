import { afterEach, vi } from 'vitest';
import { resetConfigCache } from '../config';
import { redis } from './mocks/redis';

//	A complete environment, because config() validates all of it on first read.
//	Channel ids are symbolic rather than snowflake-shaped: the discord client
//	mock uses them as cache keys, and assertions read better as 'BLUE-embedded'
//	than as a 19-digit number. The schema only requires them to be non-empty.
process.env.TOKEN = 'test-token';
process.env.CLIENT_ID = 'test-client-id';
process.env.COMMAND_CHANNEL = 'command-channel';
process.env.FEEDBACK_AND_IDEAS_CHANNEL = 'feedback-channel';
process.env.ERROR_LOG_CHANNEL_ID = '999000999';
process.env.WIKI_BASE_URL = 'https://wiki.example.com';
process.env.IMAGE_BUCKET_URL = 'https://img.example.com/';
process.env.HISTORICAL_AUCTION_DATA_API = 'https://pricing.example.com';
process.env.WATCH_DURATION_IN_DAYS = '7';
process.env.DATABASE_URL = 'postgresql://test@localhost/test';
//	unit tests never tail a real log file
process.env.FAKE_LOGS = 'true';

for (const server of ['BLUE', 'GREEN', 'RED']) {
	process.env[`SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID`] =
		`${server}-classic`;
	process.env[`SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID`] =
		`${server}-embedded`;
}
// globalThis.debug_console is assigned in startLoggingAllServers, which tests never call
(globalThis as Record<string, unknown>).DEBUG_MODE = false;
(globalThis as Record<string, unknown>).debug_console = () => {};

afterEach(() => {
	vi.clearAllMocks();
	redis.clear();
	//	config() memoises; tests that override an env var would otherwise leak
	//	that value into every later test in the file
	resetConfigCache();
});
