# Agent instructions — TunnelQuestBot `run` branch

This branch is the **Linux production deploy bundle**, not the application source.
Agents must operate it safely.

## Required skills

Before any host/Docker/Compose/`manage` action, read and follow:

| Skill | Path (Cursor) | Path (Claude) |
|---|---|---|
| Safe day-to-day ops | `.cursor/skills/tunnelquestbot-operate/SKILL.md` | `.claude/skills/tunnelquestbot-operate/SKILL.md` |
| Upgrade / promote / SQLite cutover | `.cursor/skills/tunnelquestbot-deploy/SKILL.md` | `.claude/skills/tunnelquestbot-deploy/SKILL.md` |

Human pin-doc: [OPERATOR.md](OPERATOR.md). Full detail: [README.md](README.md).

## Absolute red lines

- No `docker compose down -v` (or `--volumes`).
- No deleting `./data`, backups, or `tunnelquestbot_sqlite-data` without an explicit, informed user request after a healthy cutover.
- No committing `.env`, collector credential JSON, `.runtime.env`, or database files.
- Use `manage` / `./manage.sh` — not ad-hoc Compose — for production lifecycle.

## Default host workflow

```bash
cd ~/TunnelQuestBot    # as user tunnelquestbot
manage doctor
manage status
```
