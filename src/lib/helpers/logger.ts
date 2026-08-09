import { config } from '../../config';

//	Replaces the `globalThis.debug_console` this used to be.
//
//	That global was assigned inside startLoggingAllServers() in lib/parser, but
//	called from twenty button handlers in lib/content — two subsystems with
//	nothing else in common. It worked only because the parser happens to start
//	on `ready`, before any interaction can arrive; nothing expressed or enforced
//	that ordering, and every test setup had to stub the global or handlers threw.
//
//	Reads config() per call rather than caching the flag: config() is memoised,
//	so this is a property access, and tests that flip DEBUG_MODE take effect
//	without re-importing the module.
export function debug(message: string): void {
	if (config().DEBUG_MODE) {
		console.log(message);
	}
}
