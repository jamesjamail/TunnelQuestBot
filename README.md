## Containerized local development

Set up and run everything (database and app) nicely isolated in local
docker containers with just one command!

### How?
* Install Docker Desktop with WSL2 via this guide:
https://docs.docker.com/desktop/wsl/
  * Or, install docker and docker-compose on your platform of choice.
* Copy `.env.sample` to `.env` and configure your `TOKEN`/`CLIENT_ID` and log file paths.
* Run `docker-compose up --build -d`
  * Re-run this command any time you make code or config changes.

## WIP - for local dev, run:

`pscale connect tunnelquestbot main --port=3309`

`npm run start`

## push db local changes upstream

`npx prisma db push`

## connect to remote db

`pscale connect tunnelquestbot main --port=3309`

Readme below is from the template adapted for this repo...

<h1 style="text-align:center;">Discord.js v14 Bot Template</h1>

## Features

- 🟦 Typescript
- 🔥 Slash commands (supports auto complete!)
- ✉️ Message commands
- 🕛 Cooldowns
- 🏴 Detailed Permissions
- 💪 Event & Command handlers
- 🍃 MongoDB Support
