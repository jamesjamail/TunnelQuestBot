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

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
import { expand } from 'dotenv-expand';

//	Resolve against the repo, not the cwd, so `node scripts/dev.mjs` behaves the
//	same from a subdirectory as `npm run dev` does from the root.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export const devDefaults = {
	//	the compose services publish these to localhost via docker-compose.dev.yml
	DATABASE_URL:
		'postgresql://tunnelquestbot:tunn3lb0tp4ss@localhost:5432/tunnelquestbot',
	REDIS_URL: 'redis://localhost:6379',
	//	so a contributor never needs an EverQuest client to develop
	FAKE_LOGS: 'true',
};

// Only the unmodified Compose URL template gets translated to host TCP.
// A custom URL or socket directory is an explicit development setting.
const composeDatabaseTemplate = `postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@localhost/\${POSTGRES_DB}?host=\${DB_SOCKET_DIR}`;

/** Resolve defaults, dotenv expansion and shell overrides once for all children.
 * @param {Record<string, string>} defaults
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, string>} fromEnvFile
 * @returns {{ effective: Record<string, string>, applied: Record<string, string> }}
 */
export function resolveDevEnv(defaults, env, fromEnvFile) {
	const parsed = { ...defaults, ...fromEnvFile };
	const exported = Object.fromEntries(
		Object.entries(env).filter((entry) => entry[1] !== undefined),
	);
	// Match expand(config()): dotenv populates the environment before expansion.
	const effective = { ...parsed, ...exported };
	expand({ parsed, processEnv: effective });

	if (
		env.DATABASE_URL === undefined &&
		fromEnvFile.DATABASE_URL === composeDatabaseTemplate &&
		effective.DB_SOCKET_DIR === '/dbsocket'
	) {
		const database = new URL(effective.DATABASE_URL);
		database.searchParams.delete('host');
		database.port = '5432';
		effective.DATABASE_URL = database.toString();
	}

	// Give migrations, the bot and logFaker the same expanded values, including
	// references to other .env keys. Keep the caller's environment untouched.
	const applied = Object.fromEntries(
		Object.keys(parsed).map((key) => [key, effective[key]]),
	);
	return { effective, applied };
}

//	Which children the run will start, and the build outputs each needs before it
//	can be started. Exported so the decision can be tested from an .env file
//	directly, rather than inferred from which defaults were applied.
/**
 * @param {Record<string, string>} effective
 * @returns {{ label: string, entrypoint: string }[]}
 */
export function plannedChildren(effective) {
	const children = [{ label: 'node', entrypoint: 'build/index.js' }];

	if (isEnabled(effective.FAKE_LOGS)) {
		//	FAKE_LOGS makes the parser tail build/lib/fakeLogs/<SERVER>.log, which
		//	only exists because logFaker writes to it.
		children.unshift({
			label: 'logFaker',
			entrypoint: 'build/lib/parser/logFaker.js',
		});
	}

	return children;
}

//	The same spelling the bot uses, so the launcher and the process it starts
//	never disagree about whether fake logs are on.
/**
 * @param {string | undefined} value
 */
export function isEnabled(value) {
	return /^[tT]/.test(value ?? '');
}

/**
 * @param {string} path
 * @returns {Record<string, string>}
 */
export function readEnvFile(path) {
	return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {};
}

const WAIT_TIMEOUT_MS = 120_000;

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
		if (child.exitCode !== null || child.signalCode !== null) continue;
		if (process.platform === 'win32') {
			//	shell:true means each child is a cmd.exe wrapper, so SIGTERM reaches
			//	the wrapper and leaves tsc/node running - holding build/ open, which
			//	makes the next run fail. taskkill /T takes the whole tree.
			try {
				execFileSync(
					'taskkill',
					['/pid', String(child.pid), '/T', '/F'],
					{
						stdio: 'ignore',
					},
				);
			} catch {
				//	already gone, which is the outcome we wanted anyway
			}
		} else {
			child.kill('SIGTERM');
		}
	}

	//	Give them a moment to go before exiting, so the kills above actually land.
	//	Unref'd so this never keeps the loop alive on its own.
	const timer = setTimeout(() => process.exit(code), 500);
	timer.unref();

	const pending = children.filter(
		(child) => child.exitCode === null && child.signalCode === null,
	);
	if (pending.length === 0) process.exit(code);

	let remaining = pending.length;
	for (const child of pending) {
		child.once('exit', () => {
			if (--remaining === 0) process.exit(code);
		});
	}
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		shutdown(0);
	});
}

function main() {
	const { effective, applied } = resolveDevEnv(
		devDefaults,
		process.env,
		readEnvFile(join(repoRoot, '.env')),
	);
	Object.assign(process.env, applied);

	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.on(signal, () => {
			shutdown(0);
		});
	}

	//	src/prisma/generated is gitignored, so without this a checkout that has not
	//	been built yields ~70 "no exported member" errors the moment tsc starts.
	//	postinstall normally covers it; this makes the loop self-sufficient for the
	//	cases it does not (--ignore-scripts, a schema change since last install).
	console.log('[dev] generating prisma client');
	try {
		execFileSync('npx', ['prisma', 'generate'], {
			stdio: 'ignore',
			shell: process.platform === 'win32',
		});
	} catch {
		console.error(
			'[dev] prisma generate failed — run `npm run generate` to see why',
		);
		process.exit(1);
	}

	//	Migrations are applied by docker-entrypoint.sh, which the host loop never
	//	runs. Without this, `dev:deps` leaves an empty database and the bot fails
	//	on missing tables the moment it queries - the documented quickstart went
	//	straight from starting the containers to starting the bot with nothing in
	//	between. Applied with the resolved URL rather than whatever is in .env,
	//	since that may be the container's socket form.
	console.log('[dev] applying database migrations');
	try {
		execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
			stdio: 'ignore',
			shell: process.platform === 'win32',
			env: { ...process.env, DATABASE_URL: effective.DATABASE_URL },
		});
	} catch {
		console.error(
			`[dev] could not apply migrations to ${effective.DATABASE_URL}\n` +
				'[dev] is `npm run dev:deps` up? `npm run migrate` shows the error.',
		);
		process.exit(1);
	}

	const planned = plannedChildren(effective);

	console.log('[dev] watching src/ -> build/, restarting on change');
	console.log(
		planned.some((child) => child.label === 'logFaker')
			? '[dev] FAKE_LOGS is on; no EverQuest client required\n'
			: '[dev] FAKE_LOGS is off; tailing the configured EverQuest logs\n',
	);

	run('tsc', 'npx', ['tsc', '--watch', '--preserveWatchOutput']);

	//	Wait for the entrypoint to exist rather than guessing at how long the first
	//	tsc pass takes. A fixed delay is a race that only ever fails for the person
	//	this script is for: a cold clone with no .tsbuildinfo, or Windows AV
	//	scanning several hundred freshly emitted files, can take well over a few
	//	seconds, and the children below exit non-zero if their entrypoint is
	//	missing - which the handler in run() turns into a teardown on the first run.
	const entrypoints = planned.map((child) =>
		join(repoRoot, ...child.entrypoint.split('/')),
	);

	const startedAt = Date.now();
	let announcedWait = false;

	function startWhenBuilt() {
		if (shuttingDown) return;

		if (entrypoints.every((file) => existsSync(file))) {
			for (const child of planned) {
				run(
					child.label,
					'node',
					child.label === 'node'
						? [
								'--watch',
								'--enable-source-maps',
								`./${child.entrypoint}`,
							]
						: [`./${child.entrypoint}`],
				);
			}
			return;
		}

		if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
			const missing = entrypoints.find((file) => !existsSync(file));
			console.error(
				`\n[dev] tsc has not produced ${missing} after ${WAIT_TIMEOUT_MS / 1000}s.\n` +
					'[dev] the compiler output above should say why; `npm run build` reproduces it.',
			);
			shutdown(1);
			return;
		}

		if (!announcedWait && Date.now() - startedAt > 5000) {
			announcedWait = true;
			console.log('[dev] waiting for the first compile to finish...');
		}

		setTimeout(startWhenBuilt, 200);
	}

	startWhenBuilt();
}

//	Importing this module (the tests do, for the helpers above) must not start a
//	dev loop, so the side effects run only when it is the entrypoint.
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main();
}
