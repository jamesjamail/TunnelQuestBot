# TunnelQuestBot production deployment

This branch is the complete Linux production bundle. Application code is
published separately as a tested image; operators manage the deployment through
`manage` / `manage.sh` and do not need Node.js, npm, or raw Docker Compose
commands.

SQLite lives on the host under `SQLITE_DATA_PATH` (default `./data`), so
`docker compose down -v` cannot delete the database. Redis and collector JSONL
still use named volumes (`tunnelquestbot_redis-data`,
`tunnelquestbot_p99-logger-data`); prefer `manage stop` / `manage start`.

Pin a short copy of day-to-day commands in Discord from [OPERATOR.md](OPERATOR.md).
Agent runtimes (Cursor, Claude, etc.) must follow [AGENTS.md](AGENTS.md) and the
`tunnelquestbot-operate` / `tunnelquestbot-deploy` skills under `.cursor/skills/`
(mirrored in `.claude/skills/`).

## First-time setup

Requirements: Linux, Git, Docker Engine, and Docker Compose v2.

```sh
cp .env.example .env
cp p99-logger/green.example.json p99-logger/green.json
cp p99-logger/blue.example.json p99-logger/blue.json
cp p99-logger/red.example.json p99-logger/red.json
chmod 700 p99-logger
chmod 600 .env p99-logger/green.json p99-logger/blue.json p99-logger/red.json
chmod +x manage.sh
id -u
id -g
./manage.sh install-cli
```

Fill in `.env` and the collector files. A server is enabled only when both of
its Discord stream channel IDs are set. Leave both IDs blank to disable that
server. If an enabled server points at a headless JSONL path, its private
collector file must exist. Partial server configuration fails with a message
naming the missing setting. Set `P99_UID` and `P99_GID` to the numbers printed
by `id -u` and `id -g`; the manager verifies that collector credentials are
owned by that UID, and are mode 600, before starting them. Leave
`P99_*_LOGGER_IMAGE` blank unless a server needs a different collector image
than `P99_LOGGER_IMAGE`. `install-cli` puts `manage` on PATH via `~/bin`
(override with `TQB_BIN_DIR`).

Pull the promoted image, validate, back up when applicable, and start:

```sh
manage update
```

After the first update, `doctor` checks the locally pinned image and configuration
without downloading or starting anything. Before that pin exists, `doctor` and
`start` reuse the already-running bot image when `:latest` is not present locally
(common on the hand-built host that only has a digest). `start` never pulls
images, recreates the bot so `.env` changes apply, and builds the retention
image only if it is missing. After enabling a server or editing `.env`, run
`update` or `start`.

## Routine commands

```text
manage start        Start configured services
manage stop         Stop services without deleting data
manage restart      Restart configured services
manage update       Pull and apply the newest promoted production image
manage update --image <ref>
                    Pull and apply a candidate image (for example development)
manage status       Show service and health status
manage logs         Follow bot and collector logs
manage backup       Create and verify an online SQLite backup
manage doctor       Validate configuration
manage clear-cache  Clear parsed-auction cache
manage install-cli  Install `manage` on PATH (~/bin)
manage analytics start   Start optional Metabase companion
manage analytics stop    Stop Metabase (keeps its data)
manage analytics status  Show Metabase status
manage analytics logs    Follow Metabase logs
```

`./manage.sh …` still works. Run commands as the deployment user from any
directory; the script changes to the checkout automatically. Errors are
reported before services are changed whenever possible.

## Optional Metabase analytics

Metabase is an official companion for watch/user/link analytics. It is **not**
started or updated by `./manage.sh start` or `./manage.sh update`. It runs in a
separate Compose project (`tunnelquestbot-analytics`) and reads a periodic
SQLite snapshot of the production database, never the live bot database file.

```sh
manage analytics start
```

Then open `http://127.0.0.1:3000` (default bind is localhost only; use an SSH
tunnel from your laptop). On first visit, create the Metabase admin user, add a
database of type SQLite, and set the filename to `/snapshots/tunnelquestbot.db`
(container path, not a host/WSL path). `analytics start` force-recreates the
companion so compose mount changes take effect; re-run it after pulling
analytics fixes.

Useful starter questions: active watches by server, top `itemName` counts,
WTS vs WTB mix, new watches per day, pending `PlayerLink` rows.

```sh
manage analytics status
manage analytics logs
manage analytics stop
```

Override image, bind address, port, and snapshot interval with the optional
`METABASE_*` keys in `.env`. Stopping analytics does not delete
`tunnelquestbot-analytics_metabase-data` or the snapshot volume.

## Updating production

Application updates are operator-triggered:

```sh
git switch run
git pull --ff-only origin run
manage update
```

`update` pulls `prod/tunnelquestbot:latest` and the current Redis, busybox init,
and collector images, then validates the bot image against the current `.env`.
To try a candidate before promoting it, pass `--image` with any pullable ref
(tag or digest). Publishing a GitHub Release tagged `vX.Y.Z` builds
`dev/tunnelquestbot:X.Y.Z`; `dev/tunnelquestbot:latest` is no longer updated.
For example:

```sh
manage update --image ghcr.io/jamesjamail/tunnelquestbot/dev/tunnelquestbot:1.4.0
```

It records the immutable digest, deployment revision, and `.env`
fingerprint in private `.runtime.env`, so ordinary starts can never drift when
the registry tag moves. If the image, `run` revision, and `.env` are already
current, it exits without backing up, rebuilding, or reconciling services. A
changed `run` revision or `.env` is reconciled even when the application image
did not change, and that first same-image pass downloads any missing collector
or busybox images.

When the image changed, `update` requires a verified SQLite backup before
reconciling the stack. It validates collectors before activating the bot and
waits for a fresh runtime-ready log marker. If a collector fails before the bot
is replaced, the previous image keeps running. If the new bot fails after
replacement, `update` restores the previous digest automatically and reports
the verified backup path. It never automatically overwrites a database after a
bot may have accepted writes. Database migrations are idempotent and run in
the image entrypoint.

The first update from the hand-built Linux deployment recognizes the already
running promoted image and reconciles the new collector/retention definitions.
Compose reuses the same service names and Redis/collector volumes; no data
import or configuration conversion occurs for those. SQLite is a host bind
mount (`SQLITE_DATA_PATH`, default `./data`) rather than a named volume.

The old untracked `docker-compose.production.yml` is not used by `manage.sh`
and can be removed after this update succeeds.

## Backups

```sh
manage backup
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
manage status
manage logs
manage doctor
```

If a collector is not configured, remove both stream channel IDs for that
server and rerun `doctor`. If a configured collector is unhealthy, verify its
private JSON file, existing character, and account credentials.

Prefer `manage stop` / `manage start` over raw Compose. SQLite is on the host
under `./data` by default; `docker compose down -v` cannot delete it, but can
still wipe Redis and collector JSONL volumes. PostgreSQL cutover tooling was
removed after the migration completed; it remains available in this branch's
Git history if rollback archaeology is ever needed.
