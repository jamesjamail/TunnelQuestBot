//	Replaces the `globalThis.debug_console` this used to be.
//
//	That global was assigned inside startLoggingAllServers() in lib/parser, but
//	called from twenty button handlers in lib/content — two subsystems with
//	nothing else in common. It worked only because the parser happens to start
//	on `ready`, before any interaction can arrive; nothing expressed or enforced
//	that ordering, and every test setup had to stub the global or handlers threw.
//
//	Reads process.env rather than config() on purpose. config() throws
//	ConfigError on an incomplete environment, and debug() is the last statement
//	in nineteen interaction handlers - after interaction.update() has already
//	fired. Routing a log line through validation would let one throw where the
//	old global could not, turning a logging concern into a user-visible failure.
//	The same /^[tT]/ spelling the codebase has always used, so `true`, `True`
//	and `T` all count.
export function debug(message: string): void {
	if (/^[tT]/.test(process.env.DEBUG_MODE ?? '')) {
		console.log(message);
	}
}
