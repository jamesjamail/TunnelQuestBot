import { beforeEach, describe, expect, it, vi } from 'vitest';

//	index.ts loads .env itself, which would quietly repair the environment this
//	test deliberately breaks. Neutralised so process.env is the only source.
vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
vi.mock('dotenv-expand', () => ({ expand: (value: unknown) => value }));

//	Six modules import `client` from src/index.ts, errors.ts among them - which
//	most of the codebase reaches. While startup ran at module scope, importing
//	any of them registered slash commands, opened a gateway connection, called
//	process.exit(1) on an incomplete environment, and installed global process
//	handlers. None of that is anything an importer asked for.
//
//	Imported dynamically rather than in a child process so this needs no build
//	output; the CI test job runs before `npm run build`.
//	src/types.d.ts declares TOKEN as required on ProcessEnv, so `delete` on it is
//	a type error. Removing it is the whole point here.
const mutableEnv = process.env as Record<string, string | undefined>;

describe('importing a consumer of index.ts', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	async function importConsumerWithBrokenConfig() {
		//	TOKEN is the first thing config() validates
		const token = mutableEnv.TOKEN;
		delete mutableEnv.TOKEN;

		const exit = vi
			.spyOn(process, 'exit')
			.mockImplementation((() => undefined) as never);
		const before = {
			unhandledRejection: process.listenerCount('unhandledRejection'),
			uncaughtException: process.listenerCount('uncaughtException'),
		};

		try {
			await import('../src/lib/helpers/errors');

			return {
				exited: exit.mock.calls.length > 0,
				installed: {
					unhandledRejection:
						process.listenerCount('unhandledRejection') -
						before.unhandledRejection,
					uncaughtException:
						process.listenerCount('uncaughtException') -
						before.uncaughtException,
				},
			};
		} finally {
			exit.mockRestore();
			if (token === undefined) delete mutableEnv.TOKEN;
			else mutableEnv.TOKEN = token;
		}
	}

	it('does not exit the process on an incomplete environment', async () => {
		const { exited } = await importConsumerWithBrokenConfig();

		expect(exited).toBe(false);
	});

	it('does not install startup process handlers', async () => {
		const { installed } = await importConsumerWithBrokenConfig();

		expect(installed).toEqual({
			unhandledRejection: 0,
			uncaughtException: 0,
		});
	});
});
