import { afterEach, vi } from 'vitest';
import { redis } from './mocks/redis';

process.env.WIKI_BASE_URL = 'https://wiki.example.com';
process.env.IMAGE_BUCKET_URL = 'https://img.example.com/';
process.env.ERROR_LOG_CHANNEL_ID = '999000999';
process.env.HISTORICAL_AUCTION_DATA_API = 'https://pricing.example.com';
process.env.WATCH_DURATION_IN_DAYS = '7';
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
});
