#!/bin/sh
# Verify the documented cutover with an existing PostgreSQL volume and built image.
set -eu
cd "$(dirname "$0")/.."
export TQB_SMOKE_IMAGE="${1:?usage: ci-postgres-import.sh IMAGE}"
smoke_dir=$(mktemp -d)
export TQB_SMOKE_ENV_FILE="$smoke_dir/smoke.env"
export LOG_SOURCE_PATH="$smoke_dir/logs"
project="tqb-import-$$"
compose() {
	docker compose --project-name "$project" --env-file "$TQB_SMOKE_ENV_FILE" \
		-f docker-compose.yml -f docker-compose.postgres-migration.yml \
		-f "$smoke_dir/compose.yml" "$@"
}
cleanup() {
	status=$?
	trap - EXIT
	if [ "$status" -ne 0 ]; then compose logs || true; fi
	compose down -v --remove-orphans || true
	rm -rf "$smoke_dir"
	exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cp test/fixtures/smoke.env "$TQB_SMOKE_ENV_FILE"
cat >> "$TQB_SMOKE_ENV_FILE" <<'ENV'
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=tunnelquestbot_test
DB_SOCKET_DIR=/dbsocket
DATABASE_URL=postgresql://test:test@localhost/tunnelquestbot_test?host=/dbsocket
ENV
mkdir -p "$LOG_SOURCE_PATH"
cat > "$smoke_dir/compose.yml" <<'YAML'
services:
  postgres:
    container_name: !reset null
  redis:
    container_name: !reset null
  tunnelquestbot:
    container_name: !reset null
    image: ${TQB_SMOKE_IMAGE}
    build: !reset null
    pull_policy: never
    volumes:
      - type: bind
        source: ${TQB_SMOKE_ENV_FILE}
        target: /app/.env
        read_only: true
YAML

# An old .env must not silently start a fresh bot without the migration override.
if docker run --rm --network none \
	--mount "type=bind,source=$TQB_SMOKE_ENV_FILE,target=/app/.env,readonly" \
	-e DATABASE_URL=file:/tmp/guard.db --entrypoint node "$TQB_SMOKE_IMAGE" \
	./build/prisma/import-postgres.js > "$smoke_dir/guard.log" 2>&1; then
	echo 'Expected unmigrated PostgreSQL settings to prevent startup' >&2
	exit 1
fi
grep -q 'PostgreSQL settings remain in .env' "$smoke_dir/guard.log"

# Exercise the real CLI failure path without connecting or exposing either URL.
if docker run --rm --network none \
	-e POSTGRES_MIGRATION_URL=postgresql://synthetic-account:synthetic-password@localhost/db \
	-e DATABASE_URL=postgresql://private-row-data@localhost/invalid-target \
	--entrypoint node "$TQB_SMOKE_IMAGE" ./build/prisma/import-postgres.js \
	> "$smoke_dir/diagnostics.log" 2>&1; then
	echo 'Expected invalid migration configuration to fail' >&2
	exit 1
fi
grep -q 'opening SQLite: DATABASE_URL must be a local SQLite file URL' "$smoke_dir/diagnostics.log"
if grep -Eq 'synthetic-account|synthetic-password|private-row-data|postgresql://' "$smoke_dir/diagnostics.log"; then
	echo 'Migration diagnostics exposed connection details' >&2
	exit 1
fi

compose up -d --wait postgres redis
for migration in src/prisma/postgres-migrations/*/migration.sql; do
	compose exec -T postgres psql -v ON_ERROR_STOP=1 -U test -d tunnelquestbot_test < "$migration"
done
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U test -d tunnelquestbot_test < test/fixtures/postgres-import.sql
compose run --rm -e SMOKE_TEST=true tunnelquestbot
compose run --rm --no-deps --entrypoint node tunnelquestbot -e '
const assert = require("node:assert/strict");
const db = new (require("better-sqlite3"))("/data/tunnelquestbot.db", { readonly: true });
const expected = { User: 1, Watch: 512, BlockedPlayer: 1, BlockedPlayerByWatch: 1, PlayerLink: 1, DataMigration: 1 };
for (const [table, count] of Object.entries(expected)) {
  assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, count);
}
assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = ?").get("Watch").seq, 1000);
assert.equal(db.pragma("quick_check", { simple: true }), "ok");
db.close();
'
test "$(compose exec -T postgres psql -At -U test -d tunnelquestbot_test -c 'SELECT count(*) FROM "Watch"')" = 512
compose stop postgres
# --no-deps keeps PostgreSQL stopped: the completion marker must suffice.
compose run --rm --no-deps -e SMOKE_TEST=true tunnelquestbot
echo '[smoke] PostgreSQL cutover, persisted data, source retention and restart passed'
