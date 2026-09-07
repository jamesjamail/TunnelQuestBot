import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { importPostgres } from './import-postgres';

let container: StartedPostgreSqlContainer | undefined;
let source: Client;
let sourceUrl: string;

beforeAll(async () => {
	if (process.env.TEST_POSTGRES_URL)
		sourceUrl = process.env.TEST_POSTGRES_URL;
	else {
		container = await new PostgreSqlContainer('postgres:18-alpine').start();
		sourceUrl = container.getConnectionUri();
	}
	source = new Client({ connectionString: sourceUrl });
	await source.connect();
	const directory = 'src/prisma/postgres-migrations';
	for (const entry of readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name))) {
		await source.query(
			readFileSync(join(directory, entry.name, 'migration.sql'), 'utf8'),
		);
	}
});

beforeEach(async () => {
	await source.query(
		readFileSync('test/fixtures/postgres-import.sql', 'utf8'),
	);
});

afterAll(async () => {
	await source?.end();
	await container?.stop();
});

describe('PostgreSQL to SQLite import', () => {
	it('preserves all tables, UTC dates, nulls, relations and sequence high-water marks', async () => {
		const counts = await importPostgres(
			sourceUrl,
			process.env.DATABASE_URL!,
		);
		expect(counts).toEqual({
			User: 1,
			Watch: 512,
			BlockedPlayer: 1,
			BlockedPlayerByWatch: 1,
			PlayerLink: 1,
		});
		const { prisma } = await import('./init');
		const user = await prisma.user.findUniqueOrThrow({
			where: { discordUserId: '100' },
		});
		expect(user.createdAt.toISOString()).toBe('2020-02-03T04:05:06.789Z');
		expect(user.updatedAt.toISOString()).toBe('2021-03-04T05:06:07.123Z');
		const watch = await prisma.watch.findUniqueOrThrow({
			where: { id: 7 },
			include: { blockedWatches: true },
		});
		expect(watch).toMatchObject({
			itemName: 'SWORD',
			priceRequirement: 123,
			active: false,
			isPublicallyTradeable: false,
			notes: 'Unicode café and punctuation',
		});
		expect(watch.snoozedUntil?.toISOString()).toBe(
			'2035-04-05T06:07:08.456Z',
		);
		expect(watch.blockedWatches[0].id).toBe(11);
		const link = await prisma.playerLink.findUniqueOrThrow({
			where: { id: 13 },
		});
		expect(link).toMatchObject({
			server: null,
			player: null,
			linkCode: '12345678-abcd-4321-abcd-123456789abc',
		});
		expect(link.linkCodeExpiry?.toISOString()).toBe(
			'2035-04-05T06:07:08.456Z',
		);
		expect(
			await prisma.watch.count({
				where: { created: { lt: new Date('2022-01-01') } },
			}),
		).toBe(1);
		const next = await prisma.watch.create({
			data: {
				discordUserId: '100',
				server: 'BLUE',
				watchType: 'WTS',
				itemName: 'NEXT',
			},
		});
		expect(next.id).toBe(1001);
		expect(
			await source
				.query('SELECT count(*) FROM "Watch"')
				.then((result) => result.rows[0].count),
		).toBe('512');
		// A completed import no longer needs a reachable PostgreSQL server.
		expect(
			await importPostgres(
				'postgresql://test@127.0.0.1:1/unreachable',
				process.env.DATABASE_URL!,
			),
		).toBeNull();
	});

	it('refuses to replace existing SQLite data', async () => {
		const { prisma } = await import('./init');
		await prisma.user.create({
			data: { discordUserId: 'existing', discordUsername: 'Keep me' },
		});
		await expect(
			importPostgres(sourceUrl, process.env.DATABASE_URL!),
		).rejects.toThrow('nonempty');
		expect(await prisma.user.count()).toBe(1);
		expect(await prisma.watch.count()).toBe(0);
	});

	it('rolls back an interrupted copy and can retry the complete import', async () => {
		const db = new Database(process.env.DATABASE_URL!.slice(5));
		try {
			db.exec(
				`CREATE TRIGGER fail_import BEFORE INSERT ON "BlockedPlayer" BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;`,
			);
			await expect(
				importPostgres(sourceUrl, process.env.DATABASE_URL!),
			).rejects.toThrow('synthetic failure');
			for (const table of [
				'User',
				'Watch',
				'BlockedPlayer',
				'BlockedPlayerByWatch',
				'PlayerLink',
				'DataMigration',
			]) {
				expect(
					db
						.prepare(`SELECT count(*) AS count FROM "${table}"`)
						.get(),
				).toEqual({ count: 0 });
			}
			db.exec('DROP TRIGGER fail_import');
			expect(
				await importPostgres(sourceUrl, process.env.DATABASE_URL!),
			).toMatchObject({ Watch: 512 });
		} finally {
			db.close();
		}
	});
});
