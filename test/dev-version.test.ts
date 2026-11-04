import { describe, expect, it } from 'vitest';
import { devVersionFromTags } from '../scripts/dev-version.mjs';

describe('local dev version', () => {
	it('uses the highest semver tag and appends -dev', () => {
		expect(
			devVersionFromTags([
				'v1.2.0',
				'v1.10.0',
				'v1.4.0-rc.1',
				'v1.4.0',
				'latest',
				'v1.4',
			]),
		).toBe('1.10.0-dev');
	});

	it('keeps a pre-release when it is the highest tag', () => {
		expect(devVersionFromTags(['v1.4.0', 'v1.4.1-rc.2'])).toBe(
			'1.4.1-rc.2-dev',
		);
	});

	it('is dev when the checkout has no semver tags', () => {
		expect(devVersionFromTags(['', 'latest', 'v1'])).toBe('dev');
	});
});
