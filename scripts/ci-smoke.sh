#!/bin/sh
# Exercise an already-built image with disposable data and fake credentials.
set -eu

cd "$(dirname "$0")/.."
export TQB_SMOKE_IMAGE="${1:?usage: ci-smoke.sh IMAGE}"
docker image inspect "$TQB_SMOKE_IMAGE" >/dev/null

smoke_dir=$(mktemp -d)
export TQB_SMOKE_ENV_FILE="$smoke_dir/smoke.env"
export TQB_SMOKE_LOGS="$smoke_dir/fake-logs"
export LOG_SOURCE_PATH="$smoke_dir/client-logs"
project="tqb-smoke-$$"

compose() {
	docker compose --project-name "$project" --env-file "$TQB_SMOKE_ENV_FILE" \
		-f docker-compose.yml -f "$smoke_dir/compose.yml" "$@"
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
mkdir -p "$TQB_SMOKE_LOGS" "$LOG_SOURCE_PATH"
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
      - type: bind
        source: ${TQB_SMOKE_LOGS}
        target: /app/build/lib/fakeLogs
YAML

compose up -d postgres redis
compose run --rm -e SMOKE_TEST=true tunnelquestbot

# The real writer must have created a nonempty log for every supported server.
for server in BLUE GREEN RED; do
	test -s "$TQB_SMOKE_LOGS/$server.log"
	grep -q " auctions, '" "$TQB_SMOKE_LOGS/$server.log"
done
echo '[smoke] configuration, runtime assets and fake logs passed'
