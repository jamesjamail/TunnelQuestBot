---
name: tunnelquestbot-operate
description: >-
  Safely operate the TunnelQuestBot Linux production host via manage/manage.sh.
  Use when starting, stopping, restarting, checking status, reading logs, backing
  up SQLite, clearing cache, running doctor, installing the manage CLI, working
  with Metabase analytics, SSHing to the deployment host, or when any agent might
  run Docker Compose against this stack.
---

# TunnelQuestBot — safe operation

Production is the `run` branch checkout on the Linux host (user `tunnelquestbot`,
repo typically `~/TunnelQuestBot`). Application code ships as a GHCR image;
operators and agents only use `manage` / `./manage.sh`.

Read [OPERATOR.md](../../../OPERATOR.md) for the Discord cheat sheet.
Read [reference.md](reference.md) for forbidden commands and data layout.

## Hard rules (never violate)

1. Prefer `manage <cmd>` (or `./manage.sh <cmd>`). Do **not** drive production with ad-hoc `docker compose` except when `manage` cannot do the job and the user explicitly asked.
2. **Never** run `docker compose down -v` (or any `down` with `-v` / `--volumes`). That deletes Redis and collector named volumes. Prefer `manage stop` / `manage start`.
3. **Never** delete, truncate, or overwrite `./data/tunnelquestbot.db`, `SQLITE_DATA_PATH`, or `~/TunnelQuestBot-backups/*` unless the user explicitly orders a restore and has confirmed a verified backup path.
4. **Never** `docker volume rm tunnelquestbot_sqlite-data` until after a successful host-SQLite migrate **and** the user confirms `manage status` / live Discord look healthy.
5. **Never** commit or paste `.env`, `p99-logger/*.json` (non-example), `.runtime.env`, or backup DB files.
6. **Never** run `manage start` / `manage update` when host `./data` is empty but legacy volume `tunnelquestbot_sqlite-data` still has a DB — migrate first (see deploy skill).
7. Do not change `DATABASE_URL` away from the SQLite file URL on this host.

## Day-to-day commands

Run as `tunnelquestbot` from the checkout (script `cd`s itself, but stay in-repo).

| Goal | Command |
|---|---|
| Health / config | `manage doctor` |
| What’s running | `manage status` |
| Logs | `manage logs` |
| Restart | `manage restart` |
| Stop (keep data) | `manage stop` |
| Start | `manage start` |
| Backup SQLite | `manage backup` |
| Clear parse cache | `manage clear-cache` |
| Install PATH CLI | `manage install-cli` |

Metabase is optional and **not** tied to start/update:

```bash
manage analytics start|status|logs|stop
```

UI is localhost-only (`127.0.0.1:3000`); use an SSH tunnel. In Metabase, SQLite path is `/snapshots/tunnelquestbot.db`.

## Incident order

1. `manage status`
2. `manage doctor`
3. `manage logs`
4. `manage restart` if collectors/bot are unhealthy but config is OK
5. If a bad image landed after `update`, check whether rollback already happened; restore from `~/TunnelQuestBot-backups` only with explicit user approval

## One-time PATH setup

```bash
./manage.sh install-cli   # installs ~/bin/manage and PATH snippets
```

## When to switch skills

- Image upgrade, promote, candidate `--image`, or failed-update recovery → use **tunnelquestbot-deploy**.
