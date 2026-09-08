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

Do not use `update.bat` for the first SQLite deployment. The migration script:

1. pulls the promoted image and verifies that it contains the importer;
2. reads the source credentials from the existing PostgreSQL container without
   printing them;
3. asks for confirmation before stopping the bot;
4. creates and validates a private PostgreSQL dump under
   `%USERPROFILE%\TunnelQuestBot-backups`;
5. imports and verifies SQLite before changing `.env`;
6. restarts the bot on the persistent `sqlite-data` volume; and
7. stops PostgreSQL while retaining its container, volume and dump for rollback.

The script supports Windows PowerShell 5.1 and current Docker Desktop Compose.
If it fails after stopping the bot, it leaves the bot stopped and preserves the
source data. Resolve the reported error before retrying or rolling back.

## Routine operation

- `start.bat` starts the existing deployment.
- `stop.bat` stops services without deleting containers or volumes.
- `update.bat` pulls the promoted image and recreates services as needed.
- `clear_auction_data_from_redis.bat` clears cached parsed auctions.

Never run `docker compose down -v`; it deletes persistent database volumes.
