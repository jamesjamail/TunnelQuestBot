declare namespace globalThis {
	// Will be `true` if we are running in debug mode.
	// MUST use `var`, `let`/`const` don't work for this!
	var DEBUG_MODE: boolean;
	function debug_console(message: string): void;
}
