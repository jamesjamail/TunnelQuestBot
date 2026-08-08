import { describe, it, expect } from 'vitest';
import { resetConfigCache } from '../../config';
import { getEnvironmentVariable } from './env';

//	A real schema key, but not a stream channel: the helper is a generic lookup,
//	so pinning the tests to SERVERS_*_STREAM_CHANNEL_* would imply a coupling to
//	the auction streamer that no longer exists.
const KEY = 'COMMAND_CHANNEL';

function withVariable(value: string | undefined, run: () => void) {
	const original = process.env[KEY];
	if (value === undefined) delete process.env[KEY];
	else process.env[KEY] = value;
	resetConfigCache();

	try {
		run();
	} finally {
		//	restored in a finally: a failed assertion would otherwise leak the
		//	deleted variable into every test that follows
		if (original === undefined) delete process.env[KEY];
		else process.env[KEY] = original;
		resetConfigCache();
	}
}

describe('getEnvironmentVariable', () => {
	it('returns the value when it is set', () => {
		withVariable('a-value', () => {
			expect(getEnvironmentVariable(KEY)).toBe('a-value');
		});
	});

	it('surfaces a missing schema key as a config error naming it', () => {
		//	the lookup goes through config(), which validates the whole
		//	environment — so a missing value is reported by name rather than as a
		//	bare lookup miss
		withVariable(undefined, () => {
			expect(() => getEnvironmentVariable(KEY)).toThrow(
				new RegExp(`${KEY} is not set`),
			);
		});
	});

	it('throws for a key that is not part of the config schema', () => {
		//	distinct from the case above: nothing validated this name, so the
		//	failure comes from the helper itself
		expect(() => getEnvironmentVariable('NOT_A_REAL_SETTING')).toThrow(
			'Environment variable NOT_A_REAL_SETTING is not defined.',
		);
	});
});
