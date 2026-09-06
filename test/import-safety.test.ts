import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

//	Six modules import `client` from src/index.ts, errors.ts among them - which
//	most of the codebase reaches. While startup ran at module scope, importing
//	any of them registered slash commands, opened a gateway connection, called
//	process.exit(1) on an incomplete environment, and installed global process
//	handlers. None of that is something an importer asked for.
//
//	Run in a child process because the thing under test is what happens during a
//	fresh module load with a deliberately broken environment.
function importConsumer(env: Record<string, string | undefined>) {
	const script = `
		const before = {
			unhandledRejection: process.listenerCount('unhandledRejection'),
			uncaughtException: process.listenerCount('uncaughtException'),
		};
		require(${JSON.stringify(resolve('build/lib/helpers/errors.js'))});
		console.log(JSON.stringify({
			installed: {
				unhandledRejection:
					process.listenerCount('unhandledRejection') - before.unhandledRejection,
				uncaughtException:
					process.listenerCount('uncaughtException') - before.uncaughtException,
			},
		}));
	`;

	//	Run from an empty directory so index.ts's own dotenv load finds no .env and
	//	cannot quietly repair the environment we deliberately broke.
	return execFileSync('node', ['-e', script], {
		encoding: 'utf8',
		env: env as NodeJS.ProcessEnv,
		cwd: mkdtempSync(join(tmpdir(), 'import-safety-')),
	});
}

describe('importing a consumer of index.ts', () => {
	it('does not exit the process on an incomplete environment', () => {
		//	TOKEN missing, which is what config() validates first
		const { TOKEN: _dropped, ...withoutToken } = process.env;

		expect(() =>
			importConsumer({ ...withoutToken, FAKE_LOGS: 'true' }),
		).not.toThrow();
	});

	it('does not install startup process handlers', () => {
		const { TOKEN: _dropped, ...withoutToken } = process.env;
		const output = importConsumer({ ...withoutToken, FAKE_LOGS: 'true' });
		const { installed } = JSON.parse(
			output.trim().split('\n').pop() ?? '{}',
		);

		expect(installed).toEqual({
			unhandledRejection: 0,
			uncaughtException: 0,
		});
	});
});
