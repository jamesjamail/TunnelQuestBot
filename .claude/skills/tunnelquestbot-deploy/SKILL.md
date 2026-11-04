---
name: tunnelquestbot-deploy
description: >-
  Upgrade, promote, and roll forward/back TunnelQuestBot production images.
  Use when pulling the run branch, running manage update, trying a candidate
  image with --image, promoting Dev→Prod, or recovering after a failed update.
---

# TunnelQuestBot — deploy

Always load **tunnelquestbot-operate** hard rules first. This skill covers image
rollouts only.

## Standard production upgrade

1. In GitHub Actions, run **Promote Image Dev→Prod** (only when `dev` is known-good).
2. On the host as `tunnelquestbot`:

```bash
cd ~/TunnelQuestBot
git switch run
git pull --ff-only origin run
manage update
```

`manage update`:

- pulls promoted `prod/tunnelquestbot:latest` (or a candidate — see below)
- runs doctor against the new image
- creates a **verified** SQLite backup when the bot was already running
- pins digest + revision in `.runtime.env`
- recreates services; **auto-rolls back the image** if the new bot fails readiness
- does **not** start Metabase

If image, `run` revision, and `.env` fingerprint are unchanged, update no-ops.

## Candidate image before promote

```bash
manage update --image ghcr.io/jamesjamail/tunnelquestbot/dev/tunnelquestbot:latest
```

Observe Discord + `manage status` / `logs`. Only then promote and run plain `manage update`.

## Failed update

1. Read the error — update may already have restored the previous digest.
2. `manage status` and `manage logs`
3. Do **not** delete `./data` or restore over a live DB without explicit user approval
4. Last resort restore: stop bot, replace host DB from a **verified** file under `~/TunnelQuestBot-backups`, `manage start`

## Git / image hygiene

- Deploy bundle changes land on `run` (this branch). Do not invent a second production compose file.
- Do not retag GHCR images from the agent unless the user asks; prefer the Promote workflow.
- Never force-push `run`.
- SQLite is a host bind (`./data` / `SQLITE_DATA_PATH`); never recreate production against an empty data dir without a verified restore.
