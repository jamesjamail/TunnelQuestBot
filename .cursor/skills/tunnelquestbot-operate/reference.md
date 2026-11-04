# Reference — data, volumes, forbidden actions

## What lives where

| Data | Location | Survives `down -v`? |
|---|---|---|
| Bot SQLite | Host `SQLITE_DATA_PATH` (default `./data/tunnelquestbot.db`) | Yes (bind mount) |
| Verified backups | `~/TunnelQuestBot-backups/` (or `TQB_BACKUP_DIR`) | Yes (host) |
| Redis | Docker volume `tunnelquestbot_redis-data` | **No** |
| Collector JSONL | Docker volume `tunnelquestbot_p99-logger-data` | **No** |
| Legacy SQLite (pre-host-bind, if still present) | Docker volume `tunnelquestbot_sqlite-data` | **No** — do not start a blank `./data` over this; copy/restore deliberately |
| Metabase app DB / snapshots | `tunnelquestbot-analytics_*` volumes | Separate project; `analytics stop` keeps them |

Pinned image digest / revision: private `.runtime.env` (do not commit).

## Forbidden / high-risk

```text
docker compose down -v
docker compose down --volumes
docker volume rm tunnelquestbot_sqlite-data     # only after healthy migrate + user OK
docker volume rm tunnelquestbot_redis-data
docker volume rm tunnelquestbot_p99-logger-data
rm -rf ./data
rm ~/TunnelQuestBot-backups/*
```

Do not recreate the bot with a blank `./data` bind mount if production data still
only exists elsewhere (legacy volume or backup). Restore a verified DB into
`SQLITE_DATA_PATH` first.

## Compose projects

| Project | File | Managed by |
|---|---|---|
| `tunnelquestbot` | `docker-compose.yml` | `manage start\|stop\|update\|…` |
| `tunnelquestbot-analytics` | `docker-compose.metabase.yml` | `manage analytics …` only |

`manage start` / `update` must never start Metabase.

## Collector credentials

Enabled servers need both Discord stream channel IDs and, for headless JSONL, a mode-`600` `p99-logger/<server>.json` owned by `P99_UID`. Examples are `*.example.json` only.
