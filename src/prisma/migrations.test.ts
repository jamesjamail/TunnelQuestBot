import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import Database from 'better-sqlite3';

const migration = (name: string) =>
	readFileSync(`src/prisma/migrations/${name}/migration.sql`, 'utf8');

let database: Database.Database;

beforeEach(() => {
	database = new Database(':memory:');
	database.exec(migration('20260907190000_sqlite_initial'));
	database
		.prepare(
			`INSERT INTO "User" ("discordUserId", "discordUsername", "updatedAt") VALUES ('100', 'Synthetic', 0), ('200', 'Other', 0)`,
		)
		.run();
});
afterEach(() => {
	database.close();
});

function insertWatch(discordUserId: string, itemName: string): number {
	return Number(
		database
			.prepare(
				`INSERT INTO "Watch" ("discordUserId", "server", "watchType", "itemName") VALUES (?, 'BLUE', 'WTB', ?)`,
			)
			.run(discordUserId, itemName).lastInsertRowid,
	);
}

function watchSequence(): number | undefined {
	const row = database
		.prepare(`SELECT "seq" FROM "sqlite_sequence" WHERE "name" = 'Watch'`)
		.get() as { seq: number } | undefined;
	return row?.seq;
}

describe('20260916205135_marketplace_matching', () => {
	// 	Watch IDs are encoded in persistent DM buttons, so the table rebuild
	// 	must not let a deleted watch's ID be handed out again.
	it('keeps the Watch ID high-water mark when the highest IDs were deleted', () => {
		insertWatch('100', 'SWORD');
		const deleted = insertWatch('100', 'SHIELD');
		database.prepare(`DELETE FROM "Watch" WHERE "id" = ?`).run(deleted);

		database.exec(migration('20260916205135_marketplace_matching'));

		expect(watchSequence()).toBe(deleted);
		expect(insertWatch('200', 'BOOTS')).toBe(deleted + 1);
	});

	it('keeps the Watch ID high-water mark when every watch was deleted', () => {
		insertWatch('100', 'SWORD');
		const deleted = insertWatch('100', 'SHIELD');
		database.exec(`DELETE FROM "Watch"`);

		database.exec(migration('20260916205135_marketplace_matching'));

		expect(watchSequence()).toBe(deleted);
		expect(insertWatch('200', 'BOOTS')).toBe(deleted + 1);
	});

	it('starts Watch IDs from 1 when no watch ever existed', () => {
		database.exec(migration('20260916205135_marketplace_matching'));

		expect(insertWatch('200', 'BOOTS')).toBe(1);
	});

	it('copies surviving watches with their IDs unchanged', () => {
		const kept = insertWatch('100', 'SWORD');

		database.exec(migration('20260916205135_marketplace_matching'));

		expect(
			database.prepare(`SELECT "id", "itemName" FROM "Watch"`).all(),
		).toEqual([{ id: kept, itemName: 'SWORD' }]);
	});
});
