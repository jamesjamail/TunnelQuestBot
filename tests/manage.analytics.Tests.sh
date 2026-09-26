#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash -n "$SOURCE_ROOT/manage.sh"
bash -n "$SOURCE_ROOT/metabase/snapshot-entrypoint.sh"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/deploy/p99-logger" "$TEST_ROOT/deploy/metabase"
cp "$SOURCE_ROOT/manage.sh" "$TEST_ROOT/deploy/manage.sh"
cp "$SOURCE_ROOT/docker-compose.metabase.yml" "$TEST_ROOT/deploy/docker-compose.metabase.yml"
cp "$SOURCE_ROOT/metabase/snapshot-entrypoint.sh" "$TEST_ROOT/deploy/metabase/snapshot-entrypoint.sh"
chmod +x "$TEST_ROOT/deploy/manage.sh" "$TEST_ROOT/deploy/metabase/snapshot-entrypoint.sh"

cat > "$TEST_ROOT/deploy/.env" <<'EOF'
SERVERS_GREEN_STREAM_CHANNEL_CLASSIC_ID=111
SERVERS_GREEN_STREAM_CHANNEL_EMBEDDED_ID=222
SERVERS_GREEN_LOG_FILE_PATH=/p99-logger/green/chat.jsonl
P99_GREEN_CONFIG_FILE=./p99-logger/green.json
METABASE_BIND=127.0.0.1
METABASE_PORT=3000
EOF
printf 'P99_UID=%s\nP99_GID=%s\n' "$(id -u)" "$(id -g)" >> "$TEST_ROOT/deploy/.env"
echo '{}' > "$TEST_ROOT/deploy/p99-logger/green.json"
chmod 600 "$TEST_ROOT/deploy/p99-logger/green.json"

cat > "$TEST_ROOT/deploy/.runtime.env" <<'EOF'
TUNNELQUESTBOT_IMAGE=ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:promoted
TQB_DEPLOYMENT_REVISION=test
TQB_CONFIG_FINGERPRINT=test
EOF
chmod 600 "$TEST_ROOT/deploy/.runtime.env"

cat > "$TEST_ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$TQB_DOCKER_TRACE"
if [[ "$*" == "volume inspect tunnelquestbot_sqlite-data" ]]; then
	echo "[{}]"
	exit 0
fi
if [[ "$*" == "inspect tunnelquestbot --format {{.Config.Image}}" ]]; then
	echo "ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:promoted"
	exit 0
fi
if [[ "$*" == "inspect tunnelquestbot --format {{.Image}}" ]]; then
	echo "sha256:promoted"
	exit 0
fi
if [[ "$*" == "image inspect "* ]]; then
	echo "sha256:promoted"
	exit 0
fi
EOF
chmod +x "$TEST_ROOT/bin/docker"

export PATH="$TEST_ROOT/bin:$PATH"
export TQB_DOCKER_TRACE="$TEST_ROOT/docker.trace"

: > "$TQB_DOCKER_TRACE"
(
	cd "$TEST_ROOT/deploy"
	./manage.sh analytics start >/dev/null
)
grep -q 'project-name tunnelquestbot-analytics' "$TQB_DOCKER_TRACE"
grep -q 'docker-compose.metabase.yml' "$TQB_DOCKER_TRACE"
grep -q ' up -d ' "$TQB_DOCKER_TRACE"
grep -q ' pull' "$TQB_DOCKER_TRACE"

: > "$TQB_DOCKER_TRACE"
(
	cd "$TEST_ROOT/deploy"
	./manage.sh update >/dev/null || true
)
# update may fail early in this minimal mock; it must never touch analytics.
if grep -q 'tunnelquestbot-analytics' "$TQB_DOCKER_TRACE"; then
	echo "update touched the analytics project" >&2
	exit 1
fi
if grep -q 'docker-compose.metabase.yml' "$TQB_DOCKER_TRACE"; then
	echo "update referenced Metabase compose" >&2
	exit 1
fi

: > "$TQB_DOCKER_TRACE"
(
	cd "$TEST_ROOT/deploy"
	./manage.sh start >/dev/null || true
)
if grep -q 'tunnelquestbot-analytics' "$TQB_DOCKER_TRACE"; then
	echo "start touched the analytics project" >&2
	exit 1
fi

echo "manage analytics tests passed"
