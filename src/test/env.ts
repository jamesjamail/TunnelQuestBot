//	The environment both test setups need, in one place.
//
//	config() validates the whole environment on first read, so a suite that sets
//	only the few variables its own assertions touch fails on everything else.
//	The unit and integration setups drifted apart exactly that way once; keeping
//	the list here means adding a required variable to src/config.ts can only
//	break both suites at once, loudly, rather than one of them quietly.
//
//	Channel ids are symbolic rather than snowflake-shaped: the discord client
//	mock uses them as cache keys, and assertions read better as 'BLUE-embedded'
//	than as a 19-digit number. The schema only requires them to be non-empty.
export function applyTestEnvironment(): void {
	process.env.TOKEN = 'test-token';
	process.env.CLIENT_ID = 'test-client-id';
	process.env.COMMAND_CHANNEL = 'command-channel';
	process.env.FEEDBACK_AND_IDEAS_CHANNEL = 'feedback-channel';
	process.env.ERROR_LOG_CHANNEL_ID = '999000999';
	process.env.WIKI_BASE_URL = 'https://wiki.example.com';
	process.env.IMAGE_BUCKET_URL = 'https://img.example.com/';
	process.env.HISTORICAL_AUCTION_DATA_API = 'https://pricing.example.com';
	process.env.WATCH_DURATION_IN_DAYS = '7';
	//	overwritten by the integration setup once its container is up
	process.env.DATABASE_URL ??= 'postgresql://test@localhost/test';
	//	no suite tails a real log file
	process.env.FAKE_LOGS = 'true';

	for (const server of ['BLUE', 'GREEN', 'RED']) {
		process.env[`SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID`] =
			`${server}-classic`;
		process.env[`SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID`] =
			`${server}-embedded`;
	}

	//	assigned in startLoggingAllServers, which tests never call
	(globalThis as Record<string, unknown>).DEBUG_MODE = false;
	(globalThis as Record<string, unknown>).debug_console = () => {};
}
