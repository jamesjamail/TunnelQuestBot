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

## How images move

1. **GitHub Release** `vX.Y.Z` → CI builds/smoke-tests and tags  
   `ghcr.io/…/dev/tunnelquestbot:X.Y.Z` (`dev:latest` is not updated).
2. Candidate on host (optional): `manage update --image …/dev/tunnelquestbot:X.Y.Z`
3. **Promote Image Dev→Prod** with version `X.Y.Z` → points `prod:X.Y.Z` and `prod:latest` at that digest.
4. Host: `manage update` pulls `prod:latest`.

## Standard production upgrade

1. Confirm Release `vX.Y.Z` Image Build succeeded and (if used) candidate soak looked good.
2. In GitHub Actions, run **Promote Image Dev→Prod** with version `X.Y.Z`.
3. On the host as `tunnelquestbot`:

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
manage update --image ghcr.io/jamesjamail/tunnelquestbot/dev/tunnelquestbot:1.4.0
```

Use the semver tag from the Release (example `1.4.0`), never `dev:latest`.  
Observe Discord + `manage status` / `logs`. Only then Promote and run plain `manage update`.

## Failed update

1. Read the error — update may already have restored the previous digest.
2. `manage status` and `manage logs`
3. Do **not** delete `./data` or restore over a live DB without explicit user approval
4. Last resort restore: stop bot, replace host DB from a **verified** file under `~/TunnelQuestBot-backups`, `manage start`

## Git / image hygiene

- Deploy bundle changes land on `run` (this branch). Do not invent a second production compose file.
- Do not retag GHCR images from the agent unless the user asks; prefer Release + Promote.
- Never force-push `run`.
- SQLite is a host bind (`./data` / `SQLITE_DATA_PATH`); never recreate production against an empty data dir without a verified restore.
