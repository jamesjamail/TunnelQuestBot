import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { prepareSqliteUrl } from './sqlite-url';

class SqliteAdapter extends PrismaBetterSqlite3 {
	async connect() {
		const connection = await super.connect();
		try {
			await connection.executeScript(
				'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
			);
			return connection;
		} catch (error) {
			await connection.dispose();
			throw error;
		}
	}
}

/** Use the same timestamp representation as Prisma's SQLite migration engine. */
export function createSqliteAdapter(url: string) {
	return new SqliteAdapter(
		{ url: prepareSqliteUrl(url), timeout: 5000 },
		{ timestampFormat: 'unixepoch-ms' },
	);
}
