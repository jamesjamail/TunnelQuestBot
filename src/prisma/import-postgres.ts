import Database from 'better-sqlite3';
import { Client, types } from 'pg';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { prepareSqliteUrl } from './sqlite-url';
import {
	ImportFailure,
	ImportValidationError,
	describeImportFailure,
	type ImportContext,
} from './import-diagnostics';

const TABLES = [
	'User',
	'Watch',
	'BlockedPlayer',
	'BlockedPlayerByWatch',
	'PlayerLink',
] as const;
const MIGRATION = 'postgres-to-sqlite-v1';
type Column = { name: string };
type Counts = Record<string, number>;

/** Copy a consistent PostgreSQL snapshot atomically; never alter the source. */
export async function importPostgres(
	sourceUrl: string,
	sqliteUrl: string,
): Promise<Counts | null> {
	let context: ImportContext = { stage: 'validating configuration' };
	try {
		if (!/^postgres(?:ql)?:\/\//.test(sourceUrl)) {
			throw new ImportValidationError(
				'POSTGRES_MIGRATION_URL must be a PostgreSQL connection URL',
			);
		}
		// PostgreSQL timestamp-without-time-zone columns contain Prisma's UTC times.
		const source = new Client({
			connectionString: sourceUrl,
			connectionTimeoutMillis: 10000,
			query_timeout: 60000,
			types: {
				getTypeParser: (oid, format) =>
					oid === 1114
						? (value: string) =>
								new Date(`${value.replace(' ', 'T')}Z`)
						: types.getTypeParser(oid, format),
			},
		});
		context.stage = 'opening SQLite';
		const target = new Database(prepareSqliteUrl(sqliteUrl).slice(5));
		try {
			context.stage = 'checking destination';
			target.pragma('foreign_keys = ON');
			target.exec('BEGIN IMMEDIATE');
			if (
				target
					.prepare('SELECT 1 FROM "DataMigration" WHERE name = ?')
					.get(MIGRATION)
			) {
				target.exec('ROLLBACK');
				return null;
			}
			for (const table of TABLES) {
				if (target.prepare(`SELECT 1 FROM "${table}" LIMIT 1`).get()) {
					throw new ImportValidationError(
						'Refusing to import into a nonempty SQLite database',
					);
				}
			}
			context.stage = 'connecting to PostgreSQL';
			await source.connect();
			context.stage = 'starting source snapshot';
			await source.query(
				'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
			);
			await source.query("SET LOCAL TIME ZONE 'UTC'");
			const counts: Counts = {};
			for (const table of TABLES) {
				context = { stage: 'copying table', table };
				const columns = target.pragma(
					`table_info("${table}")`,
				) as Column[];
				const names = columns
					.map(({ name }) => `"${name.replaceAll('"', '""')}"`)
					.join(', ');
				const insert = target.prepare(
					`INSERT INTO "${table}" (${names}) VALUES (${columns.map(() => '?').join(', ')})`,
				);
				const count = await source.query<{ count: string }>(
					`SELECT count(*)::text AS count FROM public."${table}"`,
				);
				await source.query(
					`DECLARE tqb_import_cursor NO SCROLL CURSOR FOR SELECT ${names} FROM public."${table}"`,
				);
				let copied = 0;
				while (true) {
					const batch = await source.query(
						'FETCH FORWARD 500 FROM tqb_import_cursor',
					);
					if (!batch.rows.length) break;
					for (const row of batch.rows) {
						insert.run(
							...columns.map(({ name }) => {
								const value = row[name];
								if (value instanceof Date) {
									if (!Number.isFinite(value.getTime()))
										throw new ImportValidationError(
											'Invalid source timestamp',
										);
									return value.getTime();
								}
								return typeof value === 'boolean'
									? Number(value)
									: value;
							}),
						);
						copied++;
					}
				}
				await source.query('CLOSE tqb_import_cursor');
				context.stage = 'verifying table';
				const stored = target
					.prepare(`SELECT count(*) AS count FROM "${table}"`)
					.get() as { count: number };
				if (
					BigInt(copied) !== BigInt(count.rows[0].count) ||
					stored.count !== copied
				) {
					throw new ImportValidationError(
						`Row-count verification failed for ${table}`,
					);
				}
				counts[table] = copied;
				if (table !== 'User') {
					// Preserve sequence high-water marks, including IDs of deleted rows.
					const sequence = await source.query<{
						value: string | null;
					}>(
						"SELECT pg_sequence_last_value(pg_get_serial_sequence($1, 'id')::regclass)::text AS value",
						[`public."${table}"`],
					);
					const value = sequence.rows[0].value;
					if (value !== null) {
						const highWater = Number(value);
						if (!Number.isSafeInteger(highWater))
							throw new ImportValidationError(
								'Invalid source sequence',
							);
						const updated = target
							.prepare(
								'UPDATE sqlite_sequence SET seq = max(seq, ?) WHERE name = ?',
							)
							.run(highWater, table);
						if (!updated.changes)
							target
								.prepare(
									'INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)',
								)
								.run(table, highWater);
					}
				}
			}
			context = { stage: 'verifying database' };
			if ((target.pragma('foreign_key_check') as unknown[]).length)
				throw new ImportValidationError(
					'Imported foreign keys are inconsistent',
				);
			if (target.pragma('quick_check', { simple: true }) !== 'ok') {
				throw new ImportValidationError(
					'Imported SQLite database failed its integrity check',
				);
			}
			context.stage = 'committing import';
			target
				.prepare(
					'INSERT INTO "DataMigration" (name, "completedAt", counts) VALUES (?, ?, ?)',
				)
				.run(MIGRATION, Date.now(), JSON.stringify(counts));
			await source.query('ROLLBACK');
			target.exec('COMMIT');
			return counts;
		} finally {
			if (target.inTransaction) target.exec('ROLLBACK');
			target.close();
			await source.end();
		}
	} catch (error) {
		throw new ImportFailure(context, error);
	}
}

if (require.main === module) {
	const loaded = config({ quiet: true });
	const configuredDatabase = loaded.parsed?.DATABASE_URL;
	expand(loaded);
	const source = process.env.POSTGRES_MIGRATION_URL;
	if (!source && /^postgres(?:ql)?:\/\//.test(configuredDatabase ?? '')) {
		console.error(
			'[database] PostgreSQL settings remain in .env. Use the PostgreSQL migration Compose override before switching to SQLite; see docs/sqlite-migration.md.',
		);
		process.exitCode = 1;
	} else if (source) {
		importPostgres(
			source,
			process.env.DATABASE_URL ?? 'file:./data/tunnelquestbot.db',
		)
			.then((counts) =>
				console.log(
					counts
						? `[database] PostgreSQL import complete: ${JSON.stringify(counts)}`
						: '[database] PostgreSQL import already completed; using SQLite',
				),
			)
			.catch((error: unknown) => {
				console.error(
					`[database] PostgreSQL import failed during ${describeImportFailure(error)}`,
				);
				console.error(
					'[database] PostgreSQL import failed. No partial import was committed. Check the source connection, source schema and that the target is empty; see the SQLite migration guide.',
				);
				process.exitCode = 1;
			});
	}
}
