import { spawnSync } from 'child_process';
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

// Relocate only the temporary files; execute the actual entrypoint with bounded
// command stand-ins so validation and retry behavior run without Docker or logs.
function runRetention(env: Record<string, string> = {}, failFirst = false) {
	const directory = mkdtempSync(join(tmpdir(), 'tqb-retention-'));
	try {
		const script = join(directory, 'entrypoint.sh');
		const source = readFileSync(
			'p99-logger/retention-entrypoint.sh',
			'utf8',
		);
		writeFileSync(
			script,
			source.replaceAll('/tmp/logrotate.', '"$RETENTION_TMP"/logrotate.'),
		);
		const trace = join(directory, 'trace');
		const config = join(directory, 'logrotate.conf');
		const result = spawnSync(
			'sh',
			[
				'-c',
				`passes=0
logrotate() {
  passes=$((passes + 1))
  echo "rotate:$passes" >> "$TRACE"
  if [ "$passes" -eq 1 ]; then
    echo retained-state > "$2"
    [ "$FAIL_FIRST" != true ]
  else
    echo "state:$(cat "$2")" >> "$TRACE"
  fi
}
sleep() {
  echo "sleep:$1" >> "$TRACE"
  [ "$passes" -lt 2 ] || exit 77
}
. "$1"`,
				'sh',
				script,
			],
			{
				env: {
					...process.env,
					P99_JSONL_MAX_SIZE: '',
					P99_JSONL_ROTATE_COUNT: '',
					P99_JSONL_ROTATE_INTERVAL_SECONDS: '',
					...env,
					RETENTION_TMP: directory,
					TRACE: trace,
					FAIL_FIRST: String(failFirst),
				},
				encoding: 'utf8',
				timeout: 5000,
			},
		);
		expect(result.error).toBeUndefined();
		return {
			status: result.status,
			stderr: result.stderr,
			trace: existsSync(trace)
				? readFileSync(trace, 'utf8').trim().split('\n')
				: [],
			config: existsSync(config) ? readFileSync(config, 'utf8') : '',
		};
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

describe.skipIf(process.platform === 'win32')(
	'JSONL retention entrypoint',
	() => {
		it('keeps the shipped defaults and sleeps between rotation passes', () => {
			const result = runRetention();
			expect(result.status).toBe(77);
			expect(result.stderr).toBe('');
			expect(result.config).toContain('size 100M');
			expect(result.config).toContain('rotate 5');
			expect(result.trace).toEqual([
				'rotate:1',
				'sleep:300',
				'rotate:2',
				'state:retained-state',
				'sleep:300',
			]);
		});

		it.each(['0', '00', '000', '-1', '1.5', 'abc'])(
			'rejects interval %s before touching rotation files',
			(interval) => {
				const result = runRetention({
					P99_JSONL_ROTATE_INTERVAL_SECONDS: interval,
				});
				expect(result.status).toBe(1);
				expect(result.stderr).toContain(
					'P99_JSONL_ROTATE_INTERVAL_SECONDS',
				);
				expect(result.trace).toEqual([]);
				expect(result.config).toBe('');
			},
		);

		it.each(['100', '0', '0M', '00M', '1.5M', '-1M', 'M', '1m', '1g'])(
			'rejects invalid size %s before touching rotation files',
			(size) => {
				const result = runRetention({ P99_JSONL_MAX_SIZE: size });
				expect(result.status).toBe(1);
				expect(result.stderr).toContain('P99_JSONL_MAX_SIZE');
				expect(result.trace).toEqual([]);
				expect(result.config).toBe('');
			},
		);

		it.each(['1k', '1K', '001M', '2G'])(
			'accepts size %s and a positive zero-padded interval',
			(size) => {
				const result = runRetention({
					P99_JSONL_MAX_SIZE: size,
					P99_JSONL_ROTATE_INTERVAL_SECONDS: '0300',
					P99_JSONL_ROTATE_COUNT: '0',
				});
				expect(result.status).toBe(77);
				expect(result.config).toContain(`size ${size}`);
				expect(result.config).toContain('rotate 0');
				expect(result.trace).toContain('sleep:0300');
			},
		);

		it('reports a failed pass, waits, and retries with the same state', () => {
			const result = runRetention({}, true);
			expect(result.status).toBe(77);
			expect(result.stderr).toContain(
				'rotation pass failed; retrying next interval',
			);
			expect(result.trace).toEqual([
				'rotate:1',
				'sleep:300',
				'rotate:2',
				'state:retained-state',
				'sleep:300',
			]);
		});
	},
);
