# TunnelQuestBot production deployment

This branch contains only the files used by the Windows production host. It
runs the promoted `prod/tunnelquestbot:latest` image and keeps configuration in
the host's untracked `.env`.

## One-time PostgreSQL to SQLite upgrade

Promote an application image that includes SQLite support before starting the
cutover. Update this branch on the deployment host, then run:

```bat
migrate-postgres-to-sqlite.bat
```

`start.bat` and `update.bat` refuse to run while `.env` still points to
PostgreSQL. Use the migration script for the first SQLite deployment. It:

1. pulls the promoted image and verifies that it contains the importer;
2. reads the source credentials from the existing PostgreSQL container without
   printing them;
3. asks for confirmation before stopping the bot;
4. saves the original `.env`, then creates and validates a PostgreSQL dump
   under `%USERPROFILE%\TunnelQuestBot-backups`;
5. runs migrations and the importer in a one-shot container while the bot stays
   stopped, then independently compares all five table counts and verifies
   SQLite foreign keys, integrity and the import marker;
6. stops PostgreSQL, retaining its container, volume and dump for rollback;
7. changes `.env` and starts the bot on the persistent `sqlite-data` volume; and
8. checks startup stability and SQLite integrity without comparing live row
   counts to the old PostgreSQL snapshot.

The script supports Windows PowerShell 5.1 and current Docker Desktop Compose.
If it fails after stopping the bot, it leaves the bot stopped and preserves the
source data. Before SQLite startup is attempted, it restores the original `.env`
and restarts PostgreSQL if needed so the cutover can be retried. After startup
is attempted, SQLite may contain new writes: the script keeps SQLite configured
and leaves the bot stopped for repair. Fix the startup problem and use `start.bat`;
do not rerun the import or switch databases without reconciling those writes.

Both backup files contain private deployment data and must remain access
controlled. For a full rollback, stop the SQLite bot, restore the pre-cutover
`run` revision and the saved `.env`, and start that revision against the retained
PostgreSQL volume. Do not return users to the old bot until any post-cutover
changes have been reconciled; the importer does not synchronize SQLite changes
back to PostgreSQL.

## Routine operation

- `start.bat` starts the existing deployment.
- `stop.bat` stops services without deleting containers or volumes.
- `update.bat` pulls the promoted image and recreates services as needed.
- `clear_auction_data_from_redis.bat` clears cached parsed auctions.

Never run `docker compose down -v`; it deletes persistent database volumes.

## Testing the cutover scripts

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tests\cutover.Tests.ps1` with Windows PowerShell
5.1. The tests use temporary synthetic configuration and a Docker stand-in;
they do not connect to Docker or modify a deployment. They cover offline import
ordering, live additions/deletions, pre-activation failures, post-activation
recovery and the startup configuration guard.
