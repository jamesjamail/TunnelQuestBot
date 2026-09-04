import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script, no type declarations
import { devDefaults, resolveDevEnv } from '../scripts/dev.mjs';

//	Precedence is the whole point of these: the defaults are written into
//	process.env before the children spawn, and dotenv will not overwrite an entry
//	that already exists, so a default that ignored .env would beat it silently.
describe('resolveDevEnv', () => {
	const defaults = { FAKE_LOGS: 'true', REDIS_URL: 'redis://localhost:6379' };

	it('supplies a default when nothing else sets the key', () => {
		expect(resolveDevEnv(defaults, {}, {})).toEqual(defaults);
	});

	it('defers to .env, so a real log setup is not overridden', () => {
		const applied = resolveDevEnv(defaults, {}, { FAKE_LOGS: 'false' });

		expect(applied).not.toHaveProperty('FAKE_LOGS');
		expect(applied.REDIS_URL).toBe('redis://localhost:6379');
	});

	it('defers to an exported shell variable', () => {
		const applied = resolveDevEnv(
			defaults,
			{ REDIS_URL: 'redis://elsewhere:6379' },
			{},
		);

		expect(applied).not.toHaveProperty('REDIS_URL');
	});

	it('defers to .env even when the value is empty', () => {
		//	`FAKE_LOGS=` is a normal thing to find in a .env, and it means the
		//	developer touched the key - `in` is what distinguishes that from absent.
		expect(
			resolveDevEnv(defaults, {}, { FAKE_LOGS: '' }),
		).not.toHaveProperty('FAKE_LOGS');
	});

	it('does not require an EverQuest client to develop', () => {
		expect(devDefaults.FAKE_LOGS).toBe('true');
	});
});
