import { describe, it, expect, vi, afterEach } from 'vitest';
import { resetConfigCache } from '../../config';
import { debug } from './logger';

function withDebugMode(value: string | undefined, run: () => void) {
	const original = process.env.DEBUG_MODE;
	if (value === undefined) delete process.env.DEBUG_MODE;
	else process.env.DEBUG_MODE = value;
	resetConfigCache();

	try {
		run();
	} finally {
		if (original === undefined) delete process.env.DEBUG_MODE;
		else process.env.DEBUG_MODE = original;
		resetConfigCache();
	}
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('debug', () => {
	it('writes when DEBUG_MODE is on', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		withDebugMode('true', () => {
			debug('parsed an auction');
		});

		expect(log).toHaveBeenCalledWith('parsed an auction');
	});

	it('stays silent when DEBUG_MODE is off', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		withDebugMode('false', () => {
			debug('parsed an auction');
		});

		expect(log).not.toHaveBeenCalled();
	});

	it('stays silent when DEBUG_MODE is unset', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		withDebugMode(undefined, () => {
			debug('parsed an auction');
		});

		expect(log).not.toHaveBeenCalled();
	});

	it('accepts the /^[tT]/ spellings the codebase has always used', () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		for (const spelling of ['true', 'True', 'T']) {
			withDebugMode(spelling, () => {
				debug(spelling);
			});
		}

		expect(log).toHaveBeenCalledTimes(3);
	});

	it('does not throw on an incomplete environment', () => {
		//	debug() is the last statement in nineteen interaction handlers, after
		//	interaction.update() has already fired. Reading through config() would
		//	let a log line throw ConfigError where the global it replaced could
		//	not, turning a logging concern into a user-visible failure.
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const token = process.env.TOKEN;
		delete process.env.TOKEN;
		resetConfigCache();

		try {
			expect(() => {
				withDebugMode('true', () => {
					debug('still logs');
				});
			}).not.toThrow();
			expect(log).toHaveBeenCalledWith('still logs');
		} finally {
			process.env.TOKEN = token;
			resetConfigCache();
		}
	});

	it('picks up a change without re-importing', () => {
		//	the flag is read per call rather than captured at module load, which is
		//	what lets a test flip it. The global this replaced was assigned once,
		//	inside a function in a different subsystem.
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		withDebugMode('false', () => {
			debug('first');
		});
		withDebugMode('true', () => {
			debug('second');
		});

		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith('second');
	});
});
