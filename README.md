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

## Local Development

If you'd prefer not to run everquest clients for the log files, you can tell the app to fake them:

`$env:FAKE_LOGS='true'; docker-compose up --build -d`

Note: this is for powershell, your syntax could vary.

This runs `npm run dev` in the container, which runs logFaker.ts in paralell

## Running In Production

running `docker-compose up --build -d` defaults to production.