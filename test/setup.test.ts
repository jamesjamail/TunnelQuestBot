import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
// @ts-expect-error - plain .mjs so it runs before any build step
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
