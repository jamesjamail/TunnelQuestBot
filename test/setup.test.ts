import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	applyEnvUpdates,
	parseEnvFile,
	parseServerNames,
	planChannels,
	requiredChannels,
} from '../scripts/setup.mjs';

const SCHEMA = readFileSync(
	join(process.cwd(), 'src/prisma/schema.prisma'),
	'utf8',
);

describe('parseServerNames', () => {
	it('reads the real schema', () => {
		//	parsed rather than duplicated so adding a server to schema.prisma is
		//	all it takes; the script must also work before `prisma generate` has
		//	ever run, which rules out importing the generated client
		expect(parseServerNames(SCHEMA)).toEqual(['BLUE', 'GREEN', 'RED']);
	});

	it('ignores comments inside the enum', () => {
		expect(
			parseServerNames(`enum Server {
  BLUE
  // GREEN is retired
  RED
}`),
		).toEqual(['BLUE', 'RED']);
	});

	it('fails loudly when the enum is gone', () => {
		expect(() => parseServerNames('model User {}')).toThrow(/Server enum/);
	});
});

describe('requiredChannels', () => {
	it('covers every config key the bot needs', () => {
		const keys = requiredChannels(['BLUE', 'GREEN', 'RED']).map(
			(channel: { envKey: string }) => channel.envKey,
		);

		expect(keys).toHaveLength(9);
		expect(keys).toContain('SERVERS_BLUE_STREAM_CHANNEL_CLASSIC_ID');
		expect(keys).toContain('SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID');
		expect(keys).toContain('COMMAND_CHANNEL');
		expect(keys).toContain('FEEDBACK_AND_IDEAS_CHANNEL');
		expect(keys).toContain('ERROR_LOG_CHANNEL_ID');
	});

	it('names channels legally for Discord', () => {
		for (const channel of requiredChannels(['BLUE'])) {
			expect(channel.channelName).toMatch(/^[a-z0-9-]+$/);
		}
	});
});

describe('planChannels', () => {
	const channels = [
		{ envKey: 'COMMAND_CHANNEL', channelName: 'commands', description: '' },
		{
			envKey: 'ERROR_LOG_CHANNEL_ID',
			channelName: 'error-log',
			description: '',
		},
	];

	it('keeps ids that .env already has', () => {
		const plan = planChannels({
			channels,
			env: { COMMAND_CHANNEL: '111' },
			existingChannels: [],
		});

		expect(plan[0]).toMatchObject({ action: 'keep', id: '111' });
		expect(plan[1]).toMatchObject({ action: 'create' });
	});

	it('adopts a channel that already exists rather than duplicating it', () => {
		//	re-running after a partial failure must not create a second #commands
		const plan = planChannels({
			channels,
			env: {},
			existingChannels: [{ name: 'commands', id: '222' }],
		});

		expect(plan[0]).toMatchObject({ action: 'adopt', id: '222' });
		expect(plan[1]).toMatchObject({ action: 'create' });
	});

	it('replaces configured ids only with --force', () => {
		const plan = planChannels({
			channels,
			env: { COMMAND_CHANNEL: '111' },
			existingChannels: [{ name: 'commands', id: '222' }],
			force: true,
		});

		expect(plan[0]).toMatchObject({ action: 'adopt', id: '222' });
	});

	it('is idempotent once everything is configured', () => {
		const plan = planChannels({
			channels,
			env: { COMMAND_CHANNEL: '111', ERROR_LOG_CHANNEL_ID: '333' },
			existingChannels: [],
		});

		expect(
			plan.every((entry: { action: string }) => entry.action === 'keep'),
		).toBe(true);
	});
});

describe('applyEnvUpdates', () => {
	it('replaces a value in place, leaving comments and order alone', () => {
		const source = [
			'# Discord config',
			'TOKEN=abc',
			'',
			'COMMAND_CHANNEL=',
			'# trailing note',
			'',
		].join('\n');

		expect(applyEnvUpdates(source, { COMMAND_CHANNEL: '999' })).toBe(
			[
				'# Discord config',
				'TOKEN=abc',
				'',
				'COMMAND_CHANNEL=999',
				'# trailing note',
				'',
			].join('\n'),
		);
	});

	it('appends keys the file does not have yet', () => {
		const result = applyEnvUpdates('TOKEN=abc\n', {
			ERROR_LOG_CHANNEL_ID: '555',
		});

		expect(result).toContain('TOKEN=abc');
		expect(result).toContain('# Added by `npm run setup`');
		expect(result).toContain('ERROR_LOG_CHANNEL_ID=555');
	});

	it('never touches a key it was not asked to change', () => {
		const source = 'TOKEN=secret\nCOMMAND_CHANNEL=111\n';
		const result = applyEnvUpdates(source, { COMMAND_CHANNEL: '222' });

		expect(result).toContain('TOKEN=secret');
		expect(result).not.toContain('111');
	});

	it('leaves a commented-out key commented out', () => {
		const source = '# COMMAND_CHANNEL=old\nTOKEN=abc\n';
		const result = applyEnvUpdates(source, { COMMAND_CHANNEL: '222' });

		expect(result).toContain('# COMMAND_CHANNEL=old');
		expect(result).toContain('COMMAND_CHANNEL=222');
	});

	it('ends with exactly one newline', () => {
		expect(applyEnvUpdates('TOKEN=abc\n\n\n', { TOKEN: 'x' })).toBe(
			'TOKEN=x\n',
		);
	});
});

describe('parseEnvFile', () => {
	it('reads values and strips surrounding quotes', () => {
		const env = parseEnvFile(
			['TOKEN="abc"', "POSTGRES_USER='bob'", 'PLAIN=42', '# NOPE=1'].join(
				'\n',
			),
		);

		expect(env).toEqual({
			TOKEN: 'abc',
			POSTGRES_USER: 'bob',
			PLAIN: '42',
		});
	});
});

describe('applyEnvUpdates with duplicate keys', () => {
	//	dotenv and parseEnvFile both let the last assignment win, so the last one
	//	is the line that has to change. Updating the first rewrote a line nobody
	//	read and left the stale value in effect, while reporting success.
	const source = [
		'COMMAND_CHANNEL=111111111111111111',
		'# a later block overrides it',
		'COMMAND_CHANNEL=222222222222222222',
		'',
	].join('\n');

	it('rewrites the occurrence that actually wins', () => {
		const result = applyEnvUpdates(source, {
			COMMAND_CHANNEL: '999999999999999999',
		});

		const parsed = parseEnvFile(result);
		expect(parsed.COMMAND_CHANNEL).toBe('999999999999999999');
	});

	it('changes exactly one line', () => {
		const result = applyEnvUpdates(source, {
			COMMAND_CHANNEL: '999999999999999999',
		});
		const assignments = result
			.split('\n')
			.filter((line) => line.startsWith('COMMAND_CHANNEL='));

		expect(assignments).toEqual([
			'COMMAND_CHANNEL=111111111111111111',
			'COMMAND_CHANNEL=999999999999999999',
		]);
	});
});

describe('planChannels records what a write would overwrite', () => {
	const channels = [
		{ envKey: 'COMMAND_CHANNEL', channelName: 'commands', description: '' },
	];
	const existingChannels = [{ name: 'commands', id: '222222222222222222' }];

	it('flags a configured id that --force would replace', () => {
		const [entry] = planChannels({
			channels,
			env: { COMMAND_CHANNEL: '111111111111111111' },
			existingChannels,
			force: true,
		});

		expect(entry.action).toBe('adopt');
		expect(entry.previousId).toBe('111111111111111111');
	});

	it('leaves previousId unset when nothing is being replaced', () => {
		const [entry] = planChannels({
			channels,
			env: {},
			existingChannels,
			force: true,
		});

		expect(entry.action).toBe('adopt');
		expect(entry.previousId).toBeUndefined();
	});

	it('keeps a configured id untouched without --force', () => {
		const [entry] = planChannels({
			channels,
			env: { COMMAND_CHANNEL: '111111111111111111' },
			existingChannels,
			force: false,
		});

		expect(entry.action).toBe('keep');
	});
});
