import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import { PrismaClient } from './client';
import { createSqliteAdapter } from './sqlite';
import { resolveSqliteUrl } from './sqlite-url';
import { importPostgres } from './import-postgres';

let directory: string;
let url: string;
let prisma: PrismaClient;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), 'tqb-sqlite-unit-'));
	url = `file:${join(directory, 'test.db')}`;
	const database = new Database(url.slice(5));
	database.exec(
		readFileSync(
			'src/prisma/migrations/20260907190000_sqlite_initial/migration.sql',
			'utf8',
		),
	);
	database.close();
	prisma = new PrismaClient({ adapter: createSqliteAdapter(url) });
});
afterEach(async () => {
	await prisma.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

describe('SQLite storage', () => {
	it('shares one native SQLite library with Prisma', () => {
		expect(
			require.resolve('better-sqlite3', {
				paths: [require.resolve('@prisma/adapter-better-sqlite3')],
			}),
		).toBe(require.resolve('better-sqlite3'));
	});
	it('enables WAL and foreign keys, and persists across connections', async () => {
		expect(await prisma.$queryRawUnsafe('PRAGMA journal_mode')).toEqual([
			{ journal_mode: 'wal' },
		]);
		const flags = await prisma.$queryRawUnsafe<
			Array<{ foreign_keys: bigint }>
		>('PRAGMA foreign_keys');
		expect(Number(flags[0].foreign_keys)).toBe(1);
		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'Synthetic' },
		});
		await prisma.$disconnect();
		prisma = new PrismaClient({ adapter: createSqliteAdapter(url) });
		expect(await prisma.user.count()).toBe(1);
		await expect(
			prisma.watch.create({
				data: {
					discordUserId: 'missing',
					itemName: 'TEST',
					server: 'BLUE',
					watchType: 'WTB',
				},
			}),
		).rejects.toMatchObject({ code: 'P2003' });
	});
	it('compares database-default timestamps with Prisma dates correctly', async () => {
		await prisma.$executeRawUnsafe(
			'INSERT INTO "User" ("discordUserId", "discordUsername", "updatedAt") VALUES (?, ?, ?)',
			'100',
			'Synthetic',
			Date.now(),
		);
		const user = await prisma.user.findUniqueOrThrow({
			where: { discordUserId: '100' },
		});
		expect(Math.abs(user.createdAt.getTime() - Date.now())).toBeLessThan(
			5000,
		);
		expect(
			await prisma.user.count({
				where: { createdAt: { lt: new Date(Date.now() + 10000) } },
			}),
		).toBe(1);
	});
	it('keeps length, enum and UUID checks on direct SQL writes', async () => {
		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'Synthetic' },
		});
		await expect(
			prisma.$executeRawUnsafe(
				'UPDATE "User" SET "discordUsername" = ?',
				'X'.repeat(256),
			),
		).rejects.toThrow();
		await expect(
			prisma.$executeRawUnsafe(
				'INSERT INTO "Watch" ("discordUserId", server, "watchType", "itemName") VALUES (?, ?, ?, ?)',
				'100',
				'UNKNOWN',
				'WTB',
				'TEST',
			),
		).rejects.toThrow();
		await expect(
			prisma.$executeRawUnsafe(
				'INSERT INTO "PlayerLink" ("discordUserId", "linkCode") VALUES (?, ?)',
				'100',
				'not-a-uuid',
			),
		).rejects.toThrow();
	});
	it('keeps nullable compound keys and UUID case-insensitive lookup', async () => {
		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'Synthetic' },
		});
		await prisma.playerLink.createMany({
			data: [
				{
					discordUserId: '100',
					linkCode: '12345678-abcd-4321-abcd-123456789abc',
				},
				{ discordUserId: '100', linkCode: null },
			],
		});
		expect(await prisma.playerLink.count()).toBe(2);
		expect(
			await prisma.playerLink.findFirst({
				where: { linkCode: '12345678-ABCD-4321-ABCD-123456789ABC' },
			}),
		).not.toBeNull();
	});
	it('skips a completed import without connecting to its old source', async () => {
		await prisma.dataMigration.create({
			data: { name: 'postgres-to-sqlite-v1', counts: '{}' },
		});
		expect(
			await importPostgres('postgresql://unused@127.0.0.1:1/unused', url),
		).toBeNull();
	});
	it('rejects a populated target before trying the source connection', async () => {
		await prisma.user.create({
			data: { discordUserId: '100', discordUsername: 'Synthetic' },
		});
		await expect(
			importPostgres('postgresql://unused@127.0.0.1:1/unused', url),
		).rejects.toThrow('nonempty');
		expect(await prisma.user.count()).toBe(1);
	});
	it('rejects invalid source URLs without changing the target', async () => {
		await expect(importPostgres('file:other.db', url)).rejects.toThrow(
			'POSTGRES_MIGRATION_URL',
		);
		expect(await prisma.dataMigration.count()).toBe(0);
	});
});

describe('SQLite URLs', () => {
	it('resolves relative URLs consistently', () => {
		expect(resolveSqliteUrl('file:./data/test.db')).toBe(
			`file:${resolve('data/test.db')}`,
		);
	});
	it.each([
		'file:',
		'file::memory:',
		'postgresql://localhost/db',
		'file:test.db?mode=memory',
		'file://remote/db',
	])('rejects %s', (value) => {
		expect(() => resolveSqliteUrl(value)).toThrow();
	});
});
