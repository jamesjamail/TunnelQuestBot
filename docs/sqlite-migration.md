# SQLite storage and upgrading from PostgreSQL

New installations use SQLite automatically. The bot stores its database in the
`sqlite-data` Compose volume at `/data/tunnelquestbot.db`. Redis is still used
for its existing cache and notification behavior. Host development uses
`file:./data/tunnelquestbot.db`; set `DATABASE_URL` to change the host path, or
`SQLITE_DATABASE_URL` to change the container path on a persistent mount.

## What changes

TQB's production database operations use Prisma's ordinary CRUD, unique keys,
relations and cascading deletes. There are no PostgreSQL-specific production
SQL queries, extensions, arrays or JSON operators. The PostgreSQL-specific
`TRUNCATE` in the test setup has been replaced with ordered deletes.

SQLite retains the five data tables, primary keys, compound uniqueness, indexes,
foreign keys and cascading watch-block deletion. The initial SQLite migration
adds CHECK constraints for the existing 255-character fields, server/watch-type
enums and UUID link codes; Prisma's SQLite schema alone does not enforce those
native PostgreSQL types. UUID comparisons remain case-insensitive. Constraint
error details differ between drivers, so user creation now uses an idempotent
upsert before the requested action instead of interpreting PostgreSQL's named
foreign-key errors.

Connections enable foreign keys, WAL journaling and a five-second busy timeout.
Use one bot instance and a local filesystem. SQLite serializes writers; this is
not a replacement for PostgreSQL's concurrent-writer capacity, remote database
access or multi-host deployments. Do not put the WAL database on NFS/SMB.

Prisma migrations are provider-specific. The PostgreSQL migrations are archived
under `src/prisma/postgres-migrations` for the import tests and history; new
deployments use the separate SQLite history in `src/prisma/migrations`.
Future migrations that rebuild tables must preserve the explicit CHECK
constraints, UUID collation and millisecond timestamp defaults in that history.

## Upgrade an existing Compose installation

Keep the **same checkout directory, Compose project name and original `.env`**.
The migration override reconnects the original `postgres18-data` and `db-socket`
volumes. Do not run `docker compose down -v`; that deletes database volumes.
Startup refuses an old PostgreSQL `.env` without the migration override, so an
ordinary update cannot silently start the bot with empty SQLite data.

1. Stop the old bot and any other processes that write to its PostgreSQL DB.
   Leave them stopped until the cutover is verified. Take a PostgreSQL backup:

   ```sh
   docker compose stop tunnelquestbot
   docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > tqb-before-sqlite.sql
   ```

   Store that dump privately outside the repository. If you already updated the
   checkout, include `-f docker-compose.yml -f docker-compose.postgres-migration.yml`
   when addressing the old `postgres` service. Record the old application image
   or Git revision so it is available for rollback.

2. Update the checkout, retaining the original PostgreSQL `DATABASE_URL` in
   `.env`, then start the migration stack:

   ```sh
   git pull
   docker compose -f docker-compose.yml -f docker-compose.postgres-migration.yml up -d --build tunnelquestbot
   docker compose logs -f tunnelquestbot
   ```

   The target remains `file:/data/tunnelquestbot.db`. The override uses the old
   `.env` `DATABASE_URL` as `POSTGRES_MIGRATION_URL`, waits for PostgreSQL, and
   gives the bot access to the original socket. A custom/external source can
   instead be supplied explicitly in `POSTGRES_MIGRATION_URL`.

3. Look for `[database] PostgreSQL import complete` and the five table counts,
   then check existing watches, blocks, snoozes and player links in the bot.
   The importer runs after SQLite schema migration and before any bot activity.
   It copies a read-only, repeatable-read snapshot in bounded batches, preserving
   IDs, UTC timestamps, nulls, booleans and sequence high-water marks. The source
   data and PostgreSQL volume are not changed by the importer.

   Every SQLite row and the completion marker commit in one transaction after
   row-count, foreign-key and integrity verification. Any failure rolls back the imported
   rows and prevents bot startup. A restart after success skips the import,
   even if PostgreSQL is no longer reachable. It refuses to merge into existing
   SQLite data without a completion marker; move that unrelated database aside
   rather than overwriting it.

4. Stop PostgreSQL, change `.env` to the new SQLite `DATABASE_URL`, remove any
   `POSTGRES_MIGRATION_URL`, and return to the regular stack:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.postgres-migration.yml stop postgres
   # Set DATABASE_URL=file:./data/tunnelquestbot.db in .env.
   docker compose up -d tunnelquestbot
   ```

   Retain the old PostgreSQL volume and dump until satisfied with the cutover.
   The importer does not synchronize later changes in either direction.

For a non-Compose installation, stop writers, set `DATABASE_URL` to an empty
SQLite file and `POSTGRES_MIGRATION_URL` to the source, then run `npm run migrate`
and `npm run import:postgres` before starting the bot. Remove the source variable
after verifying the import. A PostgreSQL role needs SELECT access to all five
tables and the serial sequences. The source schema must include the archived
migrations; update an older source with the old application before importing.

## Backups and rollback

For a simple SQLite backup, stop the bot and copy the database from its volume;
keep any `-wal` and `-shm` companions with it if present. Alternatively use
SQLite's online backup API. Copying just the main file while the bot is running
can miss committed data still in the WAL. Store backups privately outside Git.

To roll back, stop the SQLite bot, restore the old application image/checkout
and its original PostgreSQL Compose configuration and `.env`, then start it
against the preserved PostgreSQL volume. Changes made after the SQLite cutover
are not present in that old database; reconcile them before returning users to
the old version. The importer never removes the source or performs a reverse
migration.

References: [Prisma SQLite support](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite),
[provider-specific migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues),
[SQLite WAL constraints](https://sqlite.org/wal.html).
