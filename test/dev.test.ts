import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'dotenv';
import { expand } from 'dotenv-expand';
import { parseConfig } from '../src/config';
import { describe, expect, it } from 'vitest';
import {
	devDefaults,
	isEnabled,
	plannedChildren,
	resolveDevEnv,
} from '../scripts/dev.mjs';

const envExample = () =>
	parse(readFileSync(join(process.cwd(), '.env.example'), 'utf8'));

//	Precedence is the whole point of these: the defaults are written into
//	process.env before the children spawn, and dotenv will not overwrite an entry
//	that already exists, so a default that ignored .env would beat it silently.
describe('resolveDevEnv', () => {
	const defaults = { FAKE_LOGS: 'true', REDIS_URL: 'redis://localhost:6379' };

	it('supplies a default when nothing else sets the key', () => {
		const { effective, applied } = resolveDevEnv(defaults, {}, {});

		expect(effective).toEqual(defaults);
		expect(applied).toEqual(defaults);
	});

	it('defers to .env, so a real log setup is not overridden', () => {
		const { effective, applied } = resolveDevEnv(
			defaults,
			{},
			{ FAKE_LOGS: 'false' },
		);

		expect(effective.FAKE_LOGS).toBe('false');
		// Expanded values are passed to the children unchanged.
		expect(applied.FAKE_LOGS).toBe('false');
	});

	it('defers to an exported shell variable over .env', () => {
		const { effective } = resolveDevEnv(
			defaults,
			{ REDIS_URL: 'redis://elsewhere:6379' },
			{ REDIS_URL: 'redis://from-env-file:6379' },
		);

		expect(effective.REDIS_URL).toBe('redis://elsewhere:6379');
	});

	it('defers to .env even when the value is empty', () => {
		const { effective } = resolveDevEnv(defaults, {}, { FAKE_LOGS: '' });

		expect(effective.FAKE_LOGS).toBe('');
	});

	it.each(['true', 'false'])(
		'expands FAKE_LOGS=%s before planning children',
		(value) => {
			const fromFile = {
				USE_FAKE_LOGS: value,
				FAKE_LOGS: `\${USE_FAKE_LOGS}`,
			};
			const { effective, applied } = resolveDevEnv(
				defaults,
				{},
				fromFile,
			);
			// Run the same dotenv expansion the bot performs after inheriting values.
			const childEnv = { ...process.env, ...fromFile, ...applied };
			expand({ parsed: { ...fromFile }, processEnv: childEnv });
			const fakeLogs = parseConfig({
				...childEnv,
				SERVERS_BLUE_LOG_FILE_PATH: '/logs/blue.log',
				SERVERS_GREEN_LOG_FILE_PATH: '/logs/green.log',
				SERVERS_RED_LOG_FILE_PATH: '/logs/red.log',
			}).FAKE_LOGS;
			expect(fakeLogs).toBe(value === 'true');
			expect(
				plannedChildren(effective).some(
					(child) => child.label === 'logFaker',
				),
			).toBe(fakeLogs);
		},
	);

	it('uses exported variables in forward references without mutating inputs', () => {
		const env = { USE_FAKE_LOGS: 'false' };
		const fromFile = {
			FAKE_LOGS: `\${USE_FAKE_LOGS}`,
			USE_FAKE_LOGS: 'true',
		};
		const { effective } = resolveDevEnv(defaults, env, fromFile);
		expect(effective.FAKE_LOGS).toBe('false');
		expect(env).toEqual({ USE_FAKE_LOGS: 'false' });
		expect(fromFile.FAKE_LOGS).toBe(`\${USE_FAKE_LOGS}`);
	});

	it('does not require an EverQuest client to develop', () => {
		expect(devDefaults.FAKE_LOGS).toBe('true');
	});
});

//	Both of these run against the file a contributor is told to copy, because the
//	failures they cover only appear with .env.example as the input.
describe('resolveDevEnv against the shipped .env.example', () => {
	it('spawns logFaker for the fake-log setting the file ships', () => {
		//	The launcher decides whether to spawn logFaker from this. Reading
		//	process.env instead saw undefined - the value is only in .env, which
		//	the children load and the launcher did not - so it skipped logFaker
		//	while the bot went on expecting generated files.
		const { effective } = resolveDevEnv(
			devDefaults,
			{},
			{ ...envExample(), FAKE_LOGS: 'true' },
		);
		const labels = plannedChildren(effective).map(
			(child: { label: string }) => child.label,
		);

		expect(labels).toContain('logFaker');
	});

	it('does not spawn logFaker when .env turns it off', () => {
		const { effective } = resolveDevEnv(
			devDefaults,
			{},
			{ ...envExample(), FAKE_LOGS: 'false' },
		);
		const labels = plannedChildren(effective).map(
			(child: { label: string }) => child.label,
		);

		expect(labels).not.toContain('logFaker');
		expect(labels).toContain('node');
	});

	it('spawns logFaker for a True spelling the bot would also accept', () => {
		const { effective } = resolveDevEnv(
			devDefaults,
			{},
			{ ...envExample(), FAKE_LOGS: 'True' },
		);
		const labels = plannedChildren(effective).map(
			(child: { label: string }) => child.label,
		);

		expect(labels).toContain('logFaker');
	});

	it('ignores the container database url in favour of the host default', () => {
		//	.env.example ships the compose URL, whose ?host= names a socket
		//	directory that exists in the container and not on the host.
		const shipped = envExample().DATABASE_URL;
		expect(shipped).toMatch(/[?&]host=/);

		const { effective, applied } = resolveDevEnv(
			devDefaults,
			{},
			envExample(),
		);

		expect(effective.DATABASE_URL).toBe(devDefaults.DATABASE_URL);
		expect(effective.DATABASE_URL).not.toMatch(/[?&]host=/);
		//	imposed, so the child uses it too
		expect(applied.DATABASE_URL).toBe(devDefaults.DATABASE_URL);
	});

	it('still honours a database url written for host development', () => {
		const mine = 'postgresql://me:pw@localhost:5555/mydb';
		const { effective, applied } = resolveDevEnv(
			devDefaults,
			{},
			{ ...envExample(), DATABASE_URL: mine },
		);

		expect(effective.DATABASE_URL).toBe(mine);
		expect(applied.DATABASE_URL).toBe(mine);
	});

	it.each([
		'?host=/tmp/local-postgres',
		'?sslmode=disable&host=/tmp/local-postgres',
	])('preserves a custom socket URL with %s', (query) => {
		const database = `postgresql://example:fake@localhost/custom_db${query}`;
		const { effective, applied } = resolveDevEnv(
			devDefaults,
			{},
			{
				...envExample(),
				DATABASE_URL: database,
			},
		);
		expect(effective.DATABASE_URL).toBe(database);
		expect(applied.DATABASE_URL).toBe(database);
	});

	it('preserves a custom socket directory in the Compose template', () => {
		const { effective } = resolveDevEnv(
			devDefaults,
			{},
			{
				...envExample(),
				DB_SOCKET_DIR: '/tmp/local-postgres',
				POSTGRES_DB: 'custom_db',
			},
		);
		const database = new URL(effective.DATABASE_URL);
		expect(database.searchParams.get('host')).toBe('/tmp/local-postgres');
		expect(database.pathname).toBe('/custom_db');
	});

	it('keeps configured credentials and database when translating the shipped socket', () => {
		const { effective } = resolveDevEnv(
			devDefaults,
			{},
			{
				...envExample(),
				POSTGRES_USER: 'example',
				POSTGRES_PASSWORD: 'fake',
				POSTGRES_DB: 'custom_db',
			},
		);
		expect(effective.DATABASE_URL).toBe(
			'postgresql://example:fake@localhost:5432/custom_db',
		);
	});

	it('still honours an exported container-shaped url', () => {
		//	an explicit export is a deliberate act, unlike the shipped sample
		const exported = 'postgresql://u:p@localhost/db?host=/tmp/sock';
		const { effective } = resolveDevEnv(
			devDefaults,
			{ DATABASE_URL: exported },
			envExample(),
		);

		expect(effective.DATABASE_URL).toBe(exported);
	});
});

describe('isEnabled', () => {
	//	the bot reads booleans with /^[tT]/, and an exact === 'true' here meant the
	//	launcher and the process it started could disagree
	it.each(['true', 'True', 'T', 'TRUE'])('accepts %s', (value) => {
		expect(isEnabled(value)).toBe(true);
	});

	it.each(['false', 'False', 'F', '', undefined])('rejects %s', (value) => {
		expect(isEnabled(value)).toBe(false);
	});
});
