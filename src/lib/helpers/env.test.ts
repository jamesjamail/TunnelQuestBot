import { describe, it, expect } from 'vitest';
import { getEnvironmentVariable } from './env';

//	A name with no meaning to the rest of the app: the helper is a generic
//	lookup, so pinning it to a stream channel would imply a coupling that no
//	longer exists now that it lives outside streamAuction.
const NAME = 'A_TEST_ONLY_VARIABLE';

function withVariable(value: string | undefined, run: () => void) {
	const original = process.env[NAME];
	if (value === undefined) delete process.env[NAME];
	else process.env[NAME] = value;

	try {
		run();
	} finally {
		//	restored in a finally: a failed assertion would otherwise leak the
		//	deleted variable into every test that follows
		if (original === undefined) delete process.env[NAME];
		else process.env[NAME] = original;
	}
}

describe('getEnvironmentVariable', () => {
	it('returns the value when it is set', () => {
		withVariable('a-value', () => {
			expect(getEnvironmentVariable(NAME)).toBe('a-value');
		});
	});

	it('throws, naming the variable, when it is missing', () => {
		withVariable(undefined, () => {
			expect(() => getEnvironmentVariable(NAME)).toThrow(
				`Environment variable ${NAME} is not defined.`,
			);
		});
	});

	it('treats an empty value as missing', () => {
		//	an empty string is almost always an unfilled line in .env rather than
		//	a deliberate value, so it fails the same way rather than silently
		//	propagating '' into a channel id
		withVariable('', () => {
			expect(() => getEnvironmentVariable(NAME)).toThrow(
				`Environment variable ${NAME} is not defined.`,
			);
		});
	});
});
