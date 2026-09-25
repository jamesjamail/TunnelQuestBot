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
GREEN_JSONL=/p99-logger/green/chat.jsonl
SERVERS_GREEN_LOG_FILE_PATH=${GREEN_JSONL}
P99_GREEN_CONFIG_FILE=./p99-logger/green.json
EOF
printf 'P99_UID=%s\nP99_GID=%s\n' "$(id -u)" "$(id -g)" >> "$TEST_ROOT/deploy/.env"
echo '{}' > "$TEST_ROOT/deploy/p99-logger/green.json"
chmod 600 "$TEST_ROOT/deploy/p99-logger/green.json"

cat > "$TEST_ROOT/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$TQB_DOCKER_TRACE"
if [[ "$*" == "inspect tunnelquestbot --format {{.Image}}" ]]; then
	if [[ -f "$TQB_RUNNING_IMAGE_FILE" ]]; then
		cat "$TQB_RUNNING_IMAGE_FILE"
	else
		echo "sha256:current"
	fi
	exit 0
fi
if [[ "$*" == "inspect tunnelquestbot --format {{.State.Status}}" ]]; then
	echo "running"
	exit 0
fi
if [[ "$1" == "logs" && "$*" != *"--tail"* ]]; then
	if [[ -n "${TQB_FAIL_READY_ONCE:-}" && -f "$TQB_FAIL_READY_ONCE" &&
		"$(cat "$TQB_FAIL_READY_ONCE")" == "1" ]]; then
		echo "container started"
		exit 0
	fi
	echo "Starting log monitoring for server GREEN: /data/green/chat.jsonl"
	exit 0
fi
if [[ "$*" == "image inspect tunnelquestbot-p99-log-retention" ]]; then
	echo "retention-present"
	exit 0
fi
if [[ "$*" == "image inspect "* ]]; then
	if [[ "$*" == *"RepoDigests"* ]]; then
		case "${TQB_DESIRED_IMAGE:-sha256:current}" in
			sha256:new) echo "ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:newdigest" ;;
			sha256:newer) echo "ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:newerdigest" ;;
			sha256:newest) echo "ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:newestdigest" ;;
			*) echo "ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@sha256:promoted" ;;
		esac
	else
		echo "${TQB_DESIRED_IMAGE:-sha256:current}"
	fi
	exit 0
fi
if [[ "$*" == *"--entrypoint sh tunnelquestbot -ec if [ -s /data/tunnelquestbot.db"* ]]; then
	echo "${TQB_DATABASE_STATE:-present}"
	exit 0
fi
for argument in "$@"; do
	case "$argument" in
		BACKUP_NAME=*)
			name="${argument#BACKUP_NAME=}"
			mkdir -p "$TQB_BACKUP_DIR"
			printf 'sqlite-backup' > "$TQB_BACKUP_DIR/$name"
			;;
	esac
done
if [[ -n "${TQB_FAIL_COLLECTOR_MARKER:-}" &&
	"$*" == *"up -d"* && "$*" == *"p99-green-logger"* ]]; then
	exit 1
fi
if [[ "$*" == *"up -d --force-recreate --no-build --pull never --wait --wait-timeout 180 tunnelquestbot" ]]; then
	runtime_image=""
	if [[ -f .runtime.env ]]; then
		runtime_image="$(sed -n 's/^TUNNELQUESTBOT_IMAGE=//p' .runtime.env | tail -n 1)"
	fi
	case "$runtime_image" in
		*newestdigest*) echo "sha256:newest" > "$TQB_RUNNING_IMAGE_FILE" ;;
		*newerdigest*) echo "sha256:newer" > "$TQB_RUNNING_IMAGE_FILE" ;;
		*newdigest*) echo "sha256:new" > "$TQB_RUNNING_IMAGE_FILE" ;;
		*) echo "sha256:current" > "$TQB_RUNNING_IMAGE_FILE" ;;
	esac
	if [[ -n "${TQB_FAIL_READY_ONCE:-}" ]]; then
		if [[ ! -f "$TQB_FAIL_READY_ONCE" ]]; then
			echo 1 > "$TQB_FAIL_READY_ONCE"
		else
			echo 2 > "$TQB_FAIL_READY_ONCE"
		fi
	fi
fi
EOF
chmod +x "$TEST_ROOT/bin/docker"

cat > "$TEST_ROOT/bin/stat" <<'EOF'
#!/usr/bin/env bash
set -eu
if [[ "$1" == "-c" && "$2" == "%a" ]]; then
	echo "${TQB_STAT_MODE:-600}"
	exit 0
fi
exec /usr/bin/stat "$@"
EOF
chmod +x "$TEST_ROOT/bin/stat"

cat > "$TEST_ROOT/bin/git" <<'EOF'
#!/usr/bin/env bash
set -eu
if [[ "$*" == "rev-parse HEAD" ]]; then
	echo "test-deployment-revision"
	exit 0
fi
exec /usr/bin/git "$@"
EOF
chmod +x "$TEST_ROOT/bin/git"

export PATH="$TEST_ROOT/bin:$PATH"
export TQB_DOCKER_TRACE="$TEST_ROOT/docker.trace"
export TQB_BACKUP_DIR="$TEST_ROOT/backups"
export TQB_RUNNING_IMAGE_FILE="$TEST_ROOT/running-image"

(
	cd "$TEST_ROOT/deploy"
	./manage.sh start >/dev/null
)

start_command="$(grep ' up -d ' "$TQB_DOCKER_TRACE")"
[[ "$start_command" == *"p99-green-logger"* ]]
[[ "$start_command" == *"p99-log-retention"* ]]
[[ "$start_command" == *"tunnelquestbot"* ]]
[[ "$start_command" != *"p99-blue-logger"* ]]
if grep -q ' pull ' "$TQB_DOCKER_TRACE"; then
	echo "start pulled an image" >&2
	exit 1
fi

: > "$TQB_DOCKER_TRACE"
update_output="$(
	cd "$TEST_ROOT/deploy"
	./manage.sh update
)"
[[ "$update_output" == *"deployment configuration was reconciled"* ]]
grep -q ' up -d ' "$TQB_DOCKER_TRACE"
grep -q ' pull ' "$TQB_DOCKER_TRACE"
grep -q 'p99-logger-init' "$TQB_DOCKER_TRACE"
if compgen -G "$TQB_BACKUP_DIR/tunnelquestbot-*.db" >/dev/null; then
	echo "same-image deployment reconciliation created a backup" >&2
	exit 1
fi
grep -q '^TUNNELQUESTBOT_IMAGE=.*@sha256:promoted$' "$TEST_ROOT/deploy/.runtime.env"
grep -q '^TQB_DEPLOYMENT_REVISION=test-deployment-revision$' "$TEST_ROOT/deploy/.runtime.env"
grep -q '^TQB_CONFIG_FINGERPRINT=' "$TEST_ROOT/deploy/.runtime.env"

: > "$TQB_DOCKER_TRACE"
update_output="$(
	cd "$TEST_ROOT/deploy"
	./manage.sh update
)"
[[ "$update_output" == *"Already current"* ]]
if grep -q ' up -d ' "$TQB_DOCKER_TRACE"; then
	echo "already-current update reconciled the stack" >&2
	exit 1
fi
if ! grep -q ' pull ' "$TQB_DOCKER_TRACE"; then
	echo "already-current update did not pull dependency images" >&2
	exit 1
fi
if compgen -G "$TQB_BACKUP_DIR/tunnelquestbot-*.db" >/dev/null; then
	echo "already-current update created a backup" >&2
	exit 1
fi

echo '# fingerprint-change' >> "$TEST_ROOT/deploy/.env"
: > "$TQB_DOCKER_TRACE"
update_output="$(
	cd "$TEST_ROOT/deploy"
	./manage.sh update
)"
[[ "$update_output" == *"deployment configuration was reconciled"* ]]
grep -q ' up -d ' "$TQB_DOCKER_TRACE"
if compgen -G "$TQB_BACKUP_DIR/tunnelquestbot-*.db" >/dev/null; then
	echo "env-fingerprint reconciliation created a backup" >&2
	exit 1
fi

: > "$TQB_DOCKER_TRACE"
export TQB_DESIRED_IMAGE="sha256:new"
(
	cd "$TEST_ROOT/deploy"
	./manage.sh update >/dev/null
)
grep -q ' up -d ' "$TQB_DOCKER_TRACE"
compgen -G "$TQB_BACKUP_DIR/tunnelquestbot-*.db" >/dev/null
grep -q '^TUNNELQUESTBOT_IMAGE=.*@sha256:newdigest$' "$TEST_ROOT/deploy/.runtime.env"

rm -f "$TQB_BACKUP_DIR"/*.db
: > "$TQB_DOCKER_TRACE"
export TQB_DESIRED_IMAGE="sha256:newer"
export TQB_DATABASE_STATE="absent"
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh update >"$TEST_ROOT/backup-error.log" 2>&1
); then
	echo "update unexpectedly continued without an established database" >&2
	exit 1
fi
grep -q 'No SQLite database exists to back up' "$TEST_ROOT/backup-error.log"
if grep -q ' up -d ' "$TQB_DOCKER_TRACE"; then
	echo "update continued after a missing established database" >&2
	exit 1
fi

unset TQB_DATABASE_STATE
rm -f "$TQB_BACKUP_DIR"/*.db
: > "$TQB_DOCKER_TRACE"
export TQB_DESIRED_IMAGE="sha256:newest"
export TQB_BOT_READY_TIMEOUT=1
export TQB_FAIL_READY_ONCE="$TEST_ROOT/fail-ready-once"
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh update >"$TEST_ROOT/rollback.log" 2>&1
); then
	echo "failed update unexpectedly reported success" >&2
	exit 1
fi
if ! grep -q 'was rolled back' "$TEST_ROOT/rollback.log"; then
	cat "$TEST_ROOT/rollback.log" >&2
	exit 1
fi
grep -q '^TUNNELQUESTBOT_IMAGE=.*@sha256:newdigest$' "$TEST_ROOT/deploy/.runtime.env"
if grep -q 'pre-update-rollback' "$TEST_ROOT/deploy/.runtime.env"; then
	echo "rollback wrote a local-only tag" >&2
	exit 1
fi
[[ "$(grep -c 'up -d --force-recreate --no-build --pull never --wait --wait-timeout 180 tunnelquestbot' "$TQB_DOCKER_TRACE")" -eq 2 ]]
unset TQB_DESIRED_IMAGE TQB_FAIL_READY_ONCE TQB_BOT_READY_TIMEOUT

echo "sha256:current" > "$TQB_RUNNING_IMAGE_FILE"
: > "$TQB_DOCKER_TRACE"
export TQB_DESIRED_IMAGE="sha256:newest"
export TQB_FAIL_COLLECTOR_MARKER=1
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh update >"$TEST_ROOT/collector-fail.log" 2>&1
); then
	echo "collector failure unexpectedly reported success" >&2
	exit 1
fi
if ! grep -q 'stopped before replacing the bot' "$TEST_ROOT/collector-fail.log"; then
	cat "$TEST_ROOT/collector-fail.log" >&2
	exit 1
fi
if grep -q 'rollback also failed' "$TEST_ROOT/collector-fail.log"; then
	echo "collector failure was reported as a failed rollback" >&2
	exit 1
fi
[[ "$(cat "$TQB_RUNNING_IMAGE_FILE")" == "sha256:current" ]]
grep -q '^TUNNELQUESTBOT_IMAGE=.*@sha256:newdigest$' "$TEST_ROOT/deploy/.runtime.env"
unset TQB_DESIRED_IMAGE TQB_FAIL_COLLECTOR_MARKER

: > "$TQB_DOCKER_TRACE"
(
	cd "$TEST_ROOT/deploy"
	./manage.sh doctor >/dev/null
)
if grep -q ' pull ' "$TQB_DOCKER_TRACE"; then
	echo "doctor pulled an image" >&2
	exit 1
fi
grep -q 'run --pull never' "$TQB_DOCKER_TRACE"

rm "$TEST_ROOT/deploy/p99-logger/green.json"
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh doctor >"$TEST_ROOT/error.log" 2>&1
); then
	echo "doctor unexpectedly accepted a missing Green collector config" >&2
	exit 1
fi
grep -q 'headless collector.*missing' "$TEST_ROOT/error.log"

echo '{}' > "$TEST_ROOT/deploy/p99-logger/green.json"
chmod 600 "$TEST_ROOT/deploy/p99-logger/green.json"
sed -i 's/^P99_UID=.*/P99_UID=999999/' "$TEST_ROOT/deploy/.env"
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh doctor >"$TEST_ROOT/owner-error.log" 2>&1
); then
	echo "doctor unexpectedly accepted unreadable collector credentials" >&2
	exit 1
fi
grep -q 'owned by uid.*P99_UID is 999999' "$TEST_ROOT/owner-error.log"

sed -i "s/^P99_UID=.*/P99_UID=$(id -u)/" "$TEST_ROOT/deploy/.env"
export TQB_STAT_MODE=644
if (
	cd "$TEST_ROOT/deploy"
	./manage.sh doctor >"$TEST_ROOT/mode-error.log" 2>&1
); then
	echo "doctor unexpectedly accepted world-readable collector credentials" >&2
	exit 1
fi
grep -q 'must be mode 600' "$TEST_ROOT/mode-error.log"

echo "manage.sh tests passed"
