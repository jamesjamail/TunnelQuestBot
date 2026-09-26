#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s extglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BOT_IMAGE="ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot:latest"
BACKUP_DIR="${TQB_BACKUP_DIR:-$HOME/TunnelQuestBot-backups}"
RUNTIME_ENV=".runtime.env"
RETENTION_IMAGE="tunnelquestbot-p99-log-retention"
BUILD_RETENTION_MODE="if-missing"
declare -a COMPOSE=()

refresh_compose_command() {
	COMPOSE=(docker compose --project-name tunnelquestbot --env-file .env)
	if [[ -f "$RUNTIME_ENV" ]]; then
		COMPOSE+=(--env-file "$RUNTIME_ENV")
	fi
	COMPOSE+=(--profile p99-loggers)
}

refresh_compose_command

die() {
	echo "ERROR: $*" >&2
	exit 1
}

note() {
	echo
	echo "==> $*"
}

raw_env_value() {
	local key="$1" line value=""
	while IFS= read -r line || [[ -n "$line" ]]; do
		line="${line%$'\r'}"
		[[ "$line" == *([[:space:]])\#* ]] && continue
		if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*=(.*)$ ]]; then
			value="${BASH_REMATCH[1]}"
		fi
	done < .env
	value="${value##+([[:space:]])}"
	value="${value%%+([[:space:]])}"
	if [[ "$value" == \"*\" && "$value" == *\" ]] ||
		[[ "$value" == \'*\' && "$value" == *\' ]]; then
		value="${value:1:${#value}-2}"
	fi
	printf '%s' "$value"
}

env_value() {
	local value key inner guard=0
	value="$(raw_env_value "$1")"
	while ((guard++ < 20)) && [[ "$value" =~ \$\{([A-Za-z_][A-Za-z0-9_]*)\} ]]; do
		key="${BASH_REMATCH[1]}"
		inner="$(raw_env_value "$key")"
		value="${value//\$\{${key}\}/${inner}}"
	done
	printf '%s' "$value"
}

config_fingerprint() {
	sha256sum .env | awk '{print $1}'
}

write_runtime_image() {
	local image="$1" revision="$2" fingerprint="${3:-}" temporary="${RUNTIME_ENV}.tmp"
	[[ -n "$fingerprint" ]] || fingerprint="$(config_fingerprint)"
	printf 'TUNNELQUESTBOT_IMAGE=%s\nTQB_DEPLOYMENT_REVISION=%s\nTQB_CONFIG_FINGERPRINT=%s\n' \
		"$image" "$revision" "$fingerprint" > "$temporary"
	chmod 600 "$temporary"
	mv -f "$temporary" "$RUNTIME_ENV"
	refresh_compose_command
}

runtime_value() {
	local key="$1" line value=""
	[[ -f "$RUNTIME_ENV" ]] || return 0
	while IFS= read -r line || [[ -n "$line" ]]; do
		if [[ "$line" =~ ^${key}=(.*)$ ]]; then
			value="${BASH_REMATCH[1]}"
		fi
	done < "$RUNTIME_ENV"
	printf '%s' "$value"
}

runtime_revision() {
	runtime_value TQB_DEPLOYMENT_REVISION
}

declare -a COLLECTORS=()
declare -a START_SERVICES=()
LAST_BACKUP=""

discover_services() {
	COLLECTORS=()
	local server lower classic embedded log_path config_key config_file service
	local p99_uid p99_gid owner_uid mode
	for server in GREEN BLUE RED; do
		lower="${server,,}"
		classic="$(env_value "SERVERS_${server}_STREAM_CHANNEL_CLASSIC_ID")"
		embedded="$(env_value "SERVERS_${server}_STREAM_CHANNEL_EMBEDDED_ID")"
		log_path="$(env_value "SERVERS_${server}_LOG_FILE_PATH")"

		if [[ -z "$classic" && -z "$embedded" ]]; then
			continue
		fi
		[[ -n "$classic" && -n "$embedded" ]] ||
			die "$server is partially configured; set both stream channel IDs or neither."

		if [[ "$log_path" == "/p99-logger/${lower}/chat.jsonl" ]]; then
			config_key="P99_${server}_CONFIG_FILE"
			config_file="$(env_value "$config_key")"
			[[ -n "$config_file" ]] || config_file="./p99-logger/${lower}.json"
			[[ -f "$config_file" ]] ||
				die "$server uses the headless collector, but $config_file is missing."
			p99_uid="$(env_value P99_UID)"
			p99_gid="$(env_value P99_GID)"
			[[ "$p99_uid" =~ ^[0-9]+$ && "$p99_gid" =~ ^[0-9]+$ ]] ||
				die "Set P99_UID=$(id -u) and P99_GID=$(id -g) in .env so collectors can read their private config."
			owner_uid="$(stat -c '%u' "$config_file")"
			[[ "$owner_uid" == "$p99_uid" ]] ||
				die "$config_file is owned by uid $owner_uid, but P99_UID is $p99_uid."
			mode="$(stat -c '%a' "$config_file")"
			[[ "$mode" == "600" ]] ||
				die "$config_file must be mode 600 (currently $mode). Run: chmod 600 $config_file"
			service="p99-${lower}-logger"
			COLLECTORS+=("$service")
		fi
	done

	START_SERVICES=("${COLLECTORS[@]}")
	if ((${#COLLECTORS[@]} > 0)); then
		START_SERVICES+=("p99-log-retention")
	fi
	START_SERVICES+=("tunnelquestbot")
}

docker_checks() {
	command -v docker >/dev/null 2>&1 || die "Docker is not installed."
	docker compose version >/dev/null 2>&1 ||
		die "Docker Compose v2 is not installed (the command is 'docker compose')."
}

basic_checks() {
	docker_checks
	[[ -f .env ]] || die "Missing .env. Copy .env.example to .env and fill it in."
	mkdir -p logs
	discover_services
	"${COMPOSE[@]}" config --quiet ||
		die "Compose configuration is invalid. Review the error above."
}

app_doctor() {
	local image="${1:-}"
	note "Checking application configuration"
	if [[ -n "$image" ]]; then
		TUNNELQUESTBOT_IMAGE="$image" "${COMPOSE[@]}" run --pull never --rm --no-deps -T \
			--entrypoint node tunnelquestbot ./build/doctor.js
	else
		"${COMPOSE[@]}" run --pull never --rm --no-deps -T \
			--entrypoint node tunnelquestbot ./build/doctor.js
	fi
}

cleanup_disabled_collectors() {
	local service enabled
	for service in p99-green-logger p99-blue-logger p99-red-logger; do
		enabled=false
		for configured in "${COLLECTORS[@]}"; do
			[[ "$configured" == "$service" ]] && enabled=true
		done
		if [[ "$enabled" == false ]]; then
			"${COMPOSE[@]}" stop "$service" >/dev/null 2>&1 || true
			"${COMPOSE[@]}" rm -f "$service" >/dev/null 2>&1 || true
		fi
	done
}

build_retention() {
	local mode="$BUILD_RETENTION_MODE"
	((${#COLLECTORS[@]} > 0)) || return 0
	if [[ "$mode" == "if-missing" ]] &&
		docker image inspect "$RETENTION_IMAGE" >/dev/null 2>&1; then
		return 0
	fi
	note "Preparing JSONL retention"
	"${COMPOSE[@]}" build p99-log-retention
}

pull_dependency_images() {
	local images=(redis p99-logger-init)
	if ((${#COLLECTORS[@]} > 0)); then
		images+=("${COLLECTORS[@]}")
	fi
	note "Pulling dependency images"
	"${COMPOSE[@]}" pull "${images[@]}"
}

start_dependencies() {
	cleanup_disabled_collectors
	build_retention || return 1
	note "Checking dependencies and collectors"
	if ! "${COMPOSE[@]}" up -d --no-build --pull never --wait --wait-timeout 180 redis; then
		return 1
	fi
	local rest=(p99-logger-init "${COLLECTORS[@]}")
	if ((${#COLLECTORS[@]} > 0)); then
		rest+=("p99-log-retention")
	fi
	if ! "${COMPOSE[@]}" up -d --force-recreate --no-build --pull never --wait --wait-timeout 180 \
		"${rest[@]}"; then
		return 1
	fi
}

wait_for_bot() {
	local expected_image="${1:-}" since="${2:-}"
	local timeout="${TQB_BOT_READY_TIMEOUT:-120}"
	local deadline=$((SECONDS + timeout))
	while ((SECONDS < deadline)); do
		local state image logs
		state="$(docker inspect tunnelquestbot --format '{{.State.Status}}' 2>/dev/null || true)"
		image="$(docker inspect tunnelquestbot --format '{{.Image}}' 2>/dev/null || true)"
		if [[ -n "$since" ]]; then
			logs="$(docker logs --since "$since" tunnelquestbot 2>&1 || true)"
		else
			logs="$(docker logs tunnelquestbot 2>&1 || true)"
		fi
		if [[ "$state" == "running" ]] &&
			[[ -z "$expected_image" || "$image" == "$expected_image" ]] &&
			grep -q 'Starting log monitoring for server' <<<"$logs"; then
			return 0
		fi
		sleep 2
	done
	docker logs --tail 100 tunnelquestbot >&2 || true
	return 1
}

start_stack() {
	local expected_image="${1:-}" since
	start_dependencies || return 1
	note "Starting TunnelQuestBot"
	since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	if ! "${COMPOSE[@]}" up -d --force-recreate --no-build --pull never --wait --wait-timeout 180 \
		tunnelquestbot; then
		return 1
	fi
	if ! wait_for_bot "$expected_image" "$since"; then
		echo "TunnelQuestBot did not become ready within two minutes." >&2
		return 1
	fi
	"${COMPOSE[@]}" ps
}

running_bot_image() {
	docker inspect tunnelquestbot --format '{{.Image}}' 2>/dev/null || true
}

database_exists() {
	local result
	if ! result="$(
		"${COMPOSE[@]}" run --rm --no-deps -T \
			--entrypoint sh tunnelquestbot -ec \
			'if [ -s /data/tunnelquestbot.db ]; then echo present; else echo absent; fi'
	)"; then
		die "Could not inspect the SQLite database; update aborted before changing services."
	fi
	case "$result" in
		*present*) return 0 ;;
		*absent*) return 1 ;;
		*) die "Unexpected database probe result; update aborted." ;;
	esac
}

backup_database() {
	local required="${1:-true}" stamp name
	if ! database_exists; then
		[[ "$required" == true ]] && die "No SQLite database exists to back up."
		echo "No existing SQLite database; skipping backup."
		return
	fi

	mkdir -p "$BACKUP_DIR"
	chmod 700 "$BACKUP_DIR"
	stamp="$(date -u +%Y%m%dT%H%M%SZ)"
	name="tunnelquestbot-$stamp.db"
	LAST_BACKUP="$BACKUP_DIR/$name"

	note "Creating verified SQLite backup"
	"${COMPOSE[@]}" run --rm --no-deps -T \
		-v "$BACKUP_DIR:/backup" \
		-e "BACKUP_NAME=$name" \
		-e "HOST_UID=$(id -u)" \
		-e "HOST_GID=$(id -g)" \
		--entrypoint node tunnelquestbot <<'NODE'
const Database = require('better-sqlite3');
const fs = require('fs');

(async () => {
  const source = new Database('/data/tunnelquestbot.db', { readonly: true });
  if (source.pragma('quick_check', { simple: true }) !== 'ok') {
    throw new Error('source integrity check failed');
  }
  const destination = `/backup/${process.env.BACKUP_NAME}`;
  await source.backup(destination);
  source.close();

  const backup = new Database(destination, { readonly: true });
  const integrity = backup.pragma('quick_check', { simple: true });
  backup.close();
  if (integrity !== 'ok') throw new Error('backup integrity check failed');
  fs.chownSync(destination, Number(process.env.HOST_UID), Number(process.env.HOST_GID));
  fs.chmodSync(destination, 0o600);
  console.log(`Backup verified: ${destination}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
	[[ -s "$LAST_BACKUP" ]] ||
		die "Backup command completed without creating a nonempty file."
	echo "Backup: $LAST_BACKUP"
}

update_stack() {
	local before="" desired="" desired_ref="" deployed_revision="" current_revision=""
	local previous_ref="" fingerprint="" deployed_fingerprint=""
	before="$(running_bot_image)"
	deployed_revision="$(runtime_revision)"
	previous_ref="$(runtime_value TUNNELQUESTBOT_IMAGE)"
	[[ -n "$previous_ref" ]] || previous_ref="$before"
	current_revision="$(git rev-parse HEAD)"
	fingerprint="$(config_fingerprint)"
	deployed_fingerprint="$(runtime_value TQB_CONFIG_FINGERPRINT)"

	note "Pulling the newest promoted production image"
	docker pull "$BOT_IMAGE"
	desired="$(docker image inspect "$BOT_IMAGE" --format '{{.Id}}')"
	desired_ref="$(
		docker image inspect "$BOT_IMAGE" \
			--format '{{range .RepoDigests}}{{println .}}{{end}}' |
			grep '^ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot@' |
			head -n 1
	)"
	[[ -n "$desired_ref" ]] || die "Could not resolve the promoted image digest."
	app_doctor "$desired_ref"
	BUILD_RETENTION_MODE="always"
	pull_dependency_images

	if [[ -n "$before" && "$before" == "$desired" &&
		"$deployed_revision" == "$current_revision" &&
		"$deployed_fingerprint" == "$fingerprint" ]]; then
		echo "Already current; no image or deployment change was needed."
		show_status
		return
	fi

	if [[ -n "$before" && "$before" == "$desired" ]]; then
		if ! (set -e; start_stack "$desired"); then
			die "The application image is current, but deployment reconciliation failed."
		fi
		write_runtime_image "$desired_ref" "$current_revision" "$fingerprint"
		echo "Application image was current; deployment configuration was reconciled."
		show_status
		return
	fi

	backup_database "$([[ -n "$before" ]] && echo true || echo false)"
	write_runtime_image "$desired_ref" "$current_revision" "$fingerprint"

	if ! (set -e; start_stack "$desired"); then
		if [[ -z "$before" ]]; then
			die "Initial startup failed. No previous deployment existed to restore."
		fi

		if [[ "$(running_bot_image)" == "$before" ]]; then
			write_runtime_image "$previous_ref" "${deployed_revision:-legacy}" \
				"$deployed_fingerprint"
			die "Update stopped before replacing the bot. The previous image is still running."
		fi

		echo "Update failed; restoring the previous image." >&2
		write_runtime_image "$previous_ref" "${deployed_revision:-legacy}" \
			"$deployed_fingerprint"
		if ! (set -e; start_stack "$before"); then
			die "Automatic image rollback also failed. The verified database backup is $LAST_BACKUP"
		fi
		die "Update failed and the image was rolled back. The database was preserved; verified backup: $LAST_BACKUP"
	fi

	echo "Update complete."
}

show_status() {
	"${COMPOSE[@]}" ps -a
}

show_logs() {
	"${COMPOSE[@]}" logs --tail 100 -f \
		tunnelquestbot p99-green-logger p99-blue-logger p99-red-logger
}

restart_stack() {
	note "Restarting configured services"
	"${COMPOSE[@]}" restart "${START_SERVICES[@]}"
	sleep 5
	show_status
}

clear_cache() {
	note "Clearing parsed-auction cache"
	# Expanded inside the Redis container, not by this host shell.
	# shellcheck disable=SC2016
	"${COMPOSE[@]}" exec -T redis sh -ec \
		'redis-cli --scan --pattern "auctionLog*" | while IFS= read -r key; do redis-cli DEL "$key" >/dev/null; done'
	echo "Parsed-auction cache cleared."
}

usage() {
	cat <<'EOF'
Usage: ./manage.sh <command>

  start        Validate configuration and start configured services
  stop         Stop services without deleting data
  restart      Restart configured services
  update       Pull the newest promoted image, back up, and apply it
  status       Show container status
  logs         Follow bot and configured collector logs
  backup       Create and verify an online SQLite backup
  doctor       Validate configuration without starting the bot
  clear-cache  Clear cached parsed auctions

Never run `docker compose down -v`; it deletes the database.
EOF
}

command_name="${1:-}"
case "$command_name" in
	start)
		basic_checks
		app_doctor
		BUILD_RETENTION_MODE="if-missing"
		start_stack
		;;
	stop)
		docker_checks
		"${COMPOSE[@]}" stop
		show_status
		;;
	restart)
		basic_checks
		restart_stack
		;;
	update)
		basic_checks
		update_stack
		;;
	status)
		docker_checks
		show_status
		;;
	logs)
		docker_checks
		show_logs
		;;
	backup)
		basic_checks
		backup_database true
		;;
	doctor)
		basic_checks
		app_doctor
		echo "Configuration OK."
		;;
	clear-cache)
		basic_checks
		clear_cache
		;;
	help|-h|--help|'')
		usage
		;;
	*)
		usage >&2
		die "Unknown command: $command_name"
		;;
esac
