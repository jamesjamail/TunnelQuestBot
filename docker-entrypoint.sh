#!/bin/sh
set -e

#	Migrations run here rather than inside `npm start` so that every start mode
#	gets them, and so the wait below is the only place that has to know the
#	database might not be listening yet. `migrate deploy` applies pending
#	migrations and nothing else, so re-running it is a no-op.
MIGRATE_MAX_ATTEMPTS="${MIGRATE_MAX_ATTEMPTS:-30}"
MIGRATE_RETRY_DELAY_SECONDS="${MIGRATE_RETRY_DELAY_SECONDS:-2}"

log() {
	echo "[entrypoint] $*"
}

#	A database that is not up yet is worth waiting for. Anything else - schema
#	drift, a migration that failed halfway - needs a person, and retrying it
#	only buries the reason in a restart loop.
#
#	ENOENT is deliberately not here. It means a file is missing - schema.prisma
#	or migrations/ absent from the image - which is exactly what the smoke job
#	exists to catch, and no amount of waiting produces it. Retrying spent a
#	minute burying the reason before failing anyway.
is_retryable_failure() {
	case "$1" in
		*P1001* | *P1002* | *P1017* | *ECONNREFUSED* | \
			*"Can't reach database server"*)
			return 0
			;;
	esac
	return 1
}

apply_migrations() {
	attempt=1

	while :; do
		if output="$(./node_modules/.bin/prisma migrate deploy 2>&1)"; then
			printf '%s\n' "$output"
			log 'database schema is up to date'
			return 0
		fi

		printf '%s\n' "$output"

		if ! is_retryable_failure "$output"; then
			log 'ERROR: migrations could not be applied.'
			log 'The database answered, so this is not a startup race. The bot'
			log 'will not start, because running against a schema that disagrees'
			log 'with the code is worse than being offline.'
			log 'The Prisma output above says what went wrong. A migration that'
			log 'failed partway through needs `prisma migrate resolve`:'
			log 'https://pris.ly/d/migrate-resolve'
			return 1
		fi

		if [ "$attempt" -ge "$MIGRATE_MAX_ATTEMPTS" ]; then
			log "ERROR: database was still unreachable after $attempt attempts."
			log 'Check that the postgres service is running and that DATABASE_URL'
			log 'points at it.'
			return 1
		fi

		log "database not reachable yet (attempt $attempt/$MIGRATE_MAX_ATTEMPTS); retrying in ${MIGRATE_RETRY_DELAY_SECONDS}s"
		attempt=$((attempt + 1))
		sleep "$MIGRATE_RETRY_DELAY_SECONDS"
	done
}

apply_migrations

# Create and write the real fake-log files synchronously. Both smoke mode and
# normal startup fail if the writer or its assets are missing or unwritable.
case "$FAKE_LOGS" in
	[tT]*) node ./build/lib/parser/logFaker.js --once ;;
esac

#	Smoke mode: prove the image can actually start, then exit instead of
#	connecting to Discord. Reaching this point already establishes that the
#	entrypoint runs, that the database is reachable and migrations apply, and
#	that every runtime file the Dockerfile copies is present - the Dockerfile
#	maintains that list by hand, so a new runtime file otherwise builds cleanly
#	and only fails when the container boots. CI runs this against the real
#	compose stack; see .github/workflows/docker-build.yml.
case "$SMOKE_TEST" in
	[tT]*)
		log 'smoke test: validating configuration and runtime assets'
		exec node ./build/doctor.js
		;;
esac

case "$FAKE_LOGS" in
	[tT]*)
		node ./build/lib/parser/logFaker.js &
		exec npm run debug
		;;
esac

case "$DEBUG_MODE" in
	[tT]*) exec npm run debug ;;
esac

exec npm start
