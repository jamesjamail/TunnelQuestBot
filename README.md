# TunnelQuestBot production deployment

This branch is the complete Linux production bundle. Application code is
published separately as a tested image; operators manage the deployment through
`manage.sh` and do not need Node.js, npm, or raw Docker Compose commands.

Persistent state lives in the Compose volumes named `tunnelquestbot_sqlite-data`,
`tunnelquestbot_redis-data`, and `tunnelquestbot_p99-logger-data`. Routine
commands never delete them.

## First-time setup

Requirements: Linux, Git, Docker Engine, and Docker Compose v2.

```sh
cp .env.example .env
cp p99-logger/green.example.json p99-logger/green.json
cp p99-logger/blue.example.json p99-logger/blue.json
chmod 700 p99-logger
chmod 600 .env p99-logger/green.json p99-logger/blue.json
chmod +x manage.sh
```

Fill in `.env` and the collector files. A server is enabled only when both of
its Discord stream channel IDs are set. Leave both IDs blank to disable that
server. If an enabled server points at a headless JSONL path, its private
collector file must exist. Partial server configuration fails with a message
naming the missing setting.

Validate and start:

```sh
./manage.sh doctor
./manage.sh start
```

`doctor` checks Compose and the application configuration without starting the
bot. `start` waits for Redis and configured collectors to become healthy.

## Routine commands

```text
./manage.sh start        Start configured services
./manage.sh stop         Stop services without deleting data
./manage.sh restart      Restart configured services
./manage.sh update       Pull and apply the newest promoted production image
./manage.sh status       Show service and health status
./manage.sh logs         Follow bot and collector logs
./manage.sh backup       Create and verify an online SQLite backup
./manage.sh doctor       Validate configuration
./manage.sh clear-cache  Clear parsed-auction cache
```

Run commands as the deployment user from any directory; the script changes to
the checkout automatically. Errors are reported before services are changed
whenever possible.

## Updating production

Application updates are operator-triggered:

```sh
git switch run
git pull --ff-only origin run
./manage.sh update
```

`update` pulls `prod/tunnelquestbot:latest` and validates it against the current
`.env`. If that exact image is already running, it reports that production is
current without backing up, rebuilding, or reconciling other services. It records
the immutable promoted digest in private `.runtime.env`, so ordinary starts can
never drift when the registry tag moves.

When the image changed, `update` requires a verified SQLite backup before
reconciling the stack. It validates collectors before activating the bot and
waits for the bot's runtime-ready log marker. If activation fails, it restores
the previous image automatically and reports the verified backup path. It never
automatically overwrites a database after a bot may have accepted writes.
Database migrations are idempotent and run in the image entrypoint.

The first update from the hand-built Linux deployment recognizes the already
running promoted image, records its immutable digest, and otherwise no-ops. It
reuses the same service names and `tunnelquestbot_*` volumes; no data import or
configuration conversion occurs. The old untracked
`docker-compose.production.yml` is not used by `manage.sh` and can be removed
after this update succeeds.

## Backups

```sh
./manage.sh backup
```

Backups default to `~/TunnelQuestBot-backups` (override with
`TQB_BACKUP_DIR`). The command uses SQLite's backup API while the bot is live,
checks integrity, and writes a private timestamped database owned by the
deployment user.

Keep at least one backup off-host. Test restoration before relying on a backup
policy.

## Troubleshooting

Start with:

```sh
./manage.sh status
./manage.sh logs
./manage.sh doctor
```

If a collector is not configured, remove both stream channel IDs for that
server and rerun `doctor`. If a configured collector is unhealthy, verify its
private JSON file, existing character, and account credentials.

Never run `docker compose down -v`: `-v` deletes the production database.
PostgreSQL cutover tooling was removed after the migration completed; it remains
available in this branch's Git history if rollback archaeology is ever needed.
