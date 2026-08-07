#!/usr/bin/env node
//	Host-side development loop.
//
//	Postgres and Redis run in Docker (`npm run dev:deps`); the bot runs here, on
//	the host, so a save reloads in about a second instead of rebuilding an image.
//
//	Two processes rather than `node --watch src/index.ts`: Node can strip types
//	from a .ts file, but it reparses these sources as ES modules (they use
//	`import` syntax and package.json has no "type"), and ESM requires an explicit
//	file extension on every relative import. This codebase has several hundred
//	extensionless ones, so running the sources directly needs a full ESM
//	migration. Until then tsc compiles and node watches the output.
//
//	Written as a script rather than an inline npm command so the environment
//	defaults below work the same in PowerShell as in a POSIX shell.

import { spawn } from 'node:child_process';
import process from 'node:process';

//	Only fill in what the developer has not already set. dotenv does not override
//	existing process.env entries either, so an explicit value in .env still wins
//	over these and both still lose to whatever is already exported.
const devDefaults = {
	//	the compose services publish these to localhost via docker-compose.dev.yml
	DATABASE_URL:
		'postgresql://tunnelquestbot:tunn3lb0tp4ss@localhost:5432/tunnelquestbot',
	REDIS_URL: 'redis://localhost:6379',
	//	so a contributor never needs an EverQuest client to develop
	FAKE_LOGS: 'true',
};

for (const [key, value] of Object.entries(devDefaults)) {
	process.env[key] ??= value;
}

const children = [];
let shuttingDown = false;

function run(label, command, args) {
	const child = spawn(command, args, {
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: process.env,
	});

	child.on('exit', (code, signal) => {
		if (shuttingDown) return;
		//	if either half dies the other is useless, so take the whole thing down
		//	rather than leaving a compiler running against nothing
		console.error(`\n[dev] ${label} exited (${signal ?? code}); stopping.`);
		shutdown(typeof code === 'number' ? code : 1);
	});

	children.push(child);
	return child;
}

function shutdown(code) {
	if (shuttingDown) return;
	shuttingDown = true;
	for (const child of children) {
		child.kill('SIGTERM');
	}
	process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		shutdown(0);
	});
}

console.log('[dev] watching src/ -> build/, restarting on change');
console.log('[dev] FAKE_LOGS is on; no EverQuest client required\n');

run('tsc', 'npx', ['tsc', '--watch', '--preserveWatchOutput']);

//	FAKE_LOGS makes the parser tail build/lib/fakeLogs/<SERVER>.log, which only
//	exists because this writes to it. Started after a short delay so tsc has
//	produced the output it runs from.
setTimeout(() => {
	if (shuttingDown) return;
	run('logFaker', 'node', ['./build/lib/parser/logFaker.js']);
	run('node', 'node', [
		'--watch',
		'--enable-source-maps',
		'./build/index.js',
	]);
}, 4000);
