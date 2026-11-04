# TunnelQuestBot — operator cheat sheet

SSH as `tunnelquestbot`, then (after one-time `manage install-cli`):

```bash
cd ~/TunnelQuestBot
```

Prefer `manage …` (or `./manage.sh …`). Prefer `manage stop` / `manage start` over raw Compose.

SQLite lives on the host under `./data` (override with `SQLITE_DATA_PATH`). `docker compose down -v` cannot delete it; it can still wipe Redis / collector JSONL volumes.

## Day-to-day

| Goal | Command |
|---|---|
| Health check | `manage doctor` |
| What’s running | `manage status` |
| Live logs | `manage logs` |
| Restart bot + collectors | `manage restart` |
| Stop (keep data) | `manage stop` |
| Start again | `manage start` |
| Clear auction parse cache | `manage clear-cache` |
| Backup SQLite | `manage backup` |

## Upgrade production bot

1. Promote image in GitHub (workflow: **Promote Image Dev→Prod**)
2. On host:

```bash
git pull --ff-only origin run
manage update
```

`update` pulls the promoted `prod` image, backs up the DB, applies it, and auto-rolls back the image on failure.

## Try a candidate before promote

```bash
manage update --image ghcr.io/jamesjamail/tunnelquestbot/dev/tunnelquestbot:latest
```

Promote + `manage update` only after it looks good.

## Metabase (optional)

```bash
manage analytics start|status|logs|stop
```

UI: SSH tunnel → `http://127.0.0.1:3000`  
SQLite path in Metabase: `/snapshots/tunnelquestbot.db`

## Something’s broken

1. `manage status` — any restarting/unhealthy?
2. `manage doctor`
3. `manage logs` (bot + collectors)
4. `manage restart` if needed
5. If a bad bot image landed after update, check logs; `update` should have rolled back — restore from `~/TunnelQuestBot-backups` only as a last resort

## One-time PATH setup

```bash
./manage.sh install-cli          # puts `manage` on PATH (~/bin)
```

Full detail: `README.md` on the `run` branch.
