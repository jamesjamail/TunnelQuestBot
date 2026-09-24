#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash -n "$SOURCE_ROOT/manage.sh"

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/deploy/p99-logger"
cp "$SOURCE_ROOT/manage.sh" "$TEST_ROOT/deploy/manage.sh"
chmod +x "$TEST_ROOT/deploy/manage.sh"

cat > "$TEST_ROOT/deploy/.env" <<'EOF'
SERVERS_GREEN_STREAM_CHANNEL_CLASSIC_ID=111
SERVERS_GREEN_STREAM_CHANNEL_EMBEDDED_ID=222
SERVERS_GREEN_LOG_FILE_PATH=/p99-logger/green/chat.jsonl
P99_GREEN_CONFIG_FILE=./p99-logger/green.json
EOF
echo '{}' > "$TEST_ROOT/deploy/p99-logger/green.json"

cat > "$TEST_ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$TQB_DOCKER_TRACE"
if [[ "$*" == "inspect tunnelquestbot --format {{.Image}}" ]]; then
	echo "sha256:current"
fi
for argument in "$@"; do
	case "$argument" in
		BACKUP_NAME=*)
			name="${argument#BACKUP_NAME=}"
			mkdir -p "$TQB_BACKUP_DIR"
			: > "$TQB_BACKUP_DIR/$name"
			;;
	esac
done
EOF
chmod +x "$TEST_ROOT/bin/docker"

export PATH="$TEST_ROOT/bin:$PATH"
export TQB_DOCKER_TRACE="$TEST_ROOT/docker.trace"
export TQB_BACKUP_DIR="$TEST_ROOT/backups"

(
	cd "$TEST_ROOT/deploy"
	./manage.sh start >/dev/null
)

start_command="$(grep 'compose --profile p99-loggers up -d' "$TQB_DOCKER_TRACE")"
[[ "$start_command" == *"p99-green-logger"* ]]
[[ "$start_command" == *"p99-log-retention"* ]]
[[ "$start_command" == *"tunnelquestbot"* ]]
[[ "$start_command" != *"p99-blue-logger"* ]]

update_output="$(
	cd "$TEST_ROOT/deploy"
	./manage.sh update
)"
[[ "$update_output" == *"Already current"* ]]
compgen -G "$TQB_BACKUP_DIR/tunnelquestbot-*.db" >/dev/null

rm "$TEST_ROOT/deploy/p99-logger/green.json"
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh doctor >"$TEST_ROOT/error.log" 2>&1
); then
	echo "doctor unexpectedly accepted a missing Green collector config" >&2
	exit 1
fi
grep -q 'headless collector.*missing' "$TEST_ROOT/error.log"

echo "manage.sh tests passed"
