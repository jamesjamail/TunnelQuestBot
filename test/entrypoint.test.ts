import { spawnSync } from 'child_process';
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

// Execute the real entrypoint with isolated command stand-ins. The image smoke
// test separately exercises the actual Prisma client, writer and doctor.
function runEntrypoint(
	failure?: 'migrations' | 'writer' | 'doctor',
	smoke = true,
) {
	const directory = mkdtempSync(join(tmpdir(), 'tqb-entrypoint-'));
	try {
		const bin = join(directory, 'node_modules', '.bin');
		mkdirSync(bin, { recursive: true });
		const commands = {
			prisma: 'echo migrations >> "$TRACE"; [ "$FAILURE" != migrations ]',
			node: `case "$1" in
  *logFaker.js) echo "writer $2" >> "$TRACE"; [ "$FAILURE" != writer ] ;;
  *doctor.js) echo doctor >> "$TRACE"; [ "$FAILURE" != doctor ] ;;
  *) exit 99 ;;
esac`,
			npm: 'echo bot >> "$TRACE"',
		};
		for (const [name, command] of Object.entries(commands)) {
			writeFileSync(join(bin, name), `#!/bin/sh\n${command}\n`, {
				mode: 0o755,
			});
		}
		const trace = join(directory, 'trace');
		const result = spawnSync(
			'sh',
			[join(process.cwd(), 'docker-entrypoint.sh')],
			{
				cwd: directory,
				env: {
					...process.env,
					PATH: `${bin}:${process.env.PATH}`,
					TRACE: trace,
					FAILURE: failure ?? '',
					SMOKE_TEST: smoke ? 'true' : '',
					FAKE_LOGS: 'true',
				},
				encoding: 'utf8',
				timeout: 5000,
			},
		);
		return {
			status: result.status,
			trace: readFileSync(trace, 'utf8').trim().split('\n'),
		};
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

// These process-level checks target the container's POSIX runtime.
describe.skipIf(process.platform === 'win32')('container smoke startup', () => {
	it('migrates, writes fake logs once, then validates without starting the bot', () => {
		expect(runEntrypoint()).toEqual({
			status: 0,
			trace: ['migrations', 'writer --once', 'doctor'],
		});
	});

	it.each([
		['migrations', ['migrations']],
		['writer', ['migrations', 'writer --once']],
		['doctor', ['migrations', 'writer --once', 'doctor']],
	] as const)('fails smoke when %s fails', (failure, trace) => {
		const result = runEntrypoint(failure);
		expect(result.status).toBe(1);
		expect(result.trace).toEqual(trace);
	});

	it.each([undefined, 'writer'] as const)(
		'normal startup launches the generator once and starts the bot (failure: %s)',
		(failure) => {
			const result = runEntrypoint(failure, false);
			expect(result.status).toBe(0);
			// The background writer and bot may append in either order.
			expect(result.trace.map((line) => line.trim()).sort()).toEqual([
				'bot',
				'migrations',
				'writer',
			]);
		},
	);
});
