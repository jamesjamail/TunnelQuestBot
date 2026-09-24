#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s extglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose --profile p99-loggers)
BOT_IMAGE="ghcr.io/jamesjamail/tunnelquestbot/prod/tunnelquestbot:latest"
BACKUP_DIR="${TQB_BACKUP_DIR:-$HOME/TunnelQuestBot-backups}"

die() {
	echo "ERROR: $*" >&2
	exit 1
}

note() {
	echo
	echo "==> $*"
}

env_value() {
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

declare -a COLLECTORS=()
declare -a START_SERVICES=()

discover_services() {
	COLLECTORS=()
	local server lower classic embedded log_path config_key config_file service
	for server in GREEN BLUE; do
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
	note "Checking application configuration"
	"${COMPOSE[@]}" run --rm --no-deps -T \
		--entrypoint node tunnelquestbot ./build/doctor.js
}

cleanup_disabled_collectors() {
	local service enabled
	for service in p99-green-logger p99-blue-logger; do
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
	if ((${#COLLECTORS[@]} > 0)); then
		note "Preparing JSONL retention"
		"${COMPOSE[@]}" build p99-log-retention
	fi
}

start_stack() {
	cleanup_disabled_collectors
	build_retention
	note "Starting TunnelQuestBot"
	"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 \
		"${START_SERVICES[@]}"
	"${COMPOSE[@]}" ps
}

database_exists() {
	"${COMPOSE[@]}" run --rm --no-deps -T \
		--entrypoint sh tunnelquestbot -ec \
		'test -s /data/tunnelquestbot.db' >/dev/null 2>&1
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
	echo "Backup: $BACKUP_DIR/$name"
}

update_stack() {
	local before="" after=""
	before="$(docker inspect tunnelquestbot --format '{{.Image}}' 2>/dev/null || true)"

	note "Pulling the newest promoted production image"
	"${COMPOSE[@]}" pull redis p99-logger-init tunnelquestbot "${COLLECTORS[@]}"
	app_doctor
	backup_database false
	start_stack

	after="$(docker inspect tunnelquestbot --format '{{.Image}}')"
	if [[ -n "$before" && "$before" == "$after" ]]; then
		echo "Already current; no application image change was needed."
	else
		echo "Update complete."
	fi
}

show_status() {
	"${COMPOSE[@]}" ps -a
}

show_logs() {
	"${COMPOSE[@]}" logs --tail 100 -f \
		tunnelquestbot p99-green-logger p99-blue-logger
}

restart_stack() {
	note "Restarting configured services"
	"${COMPOSE[@]}" restart "${START_SERVICES[@]}"
	sleep 5
	show_status
}

clear_cache() {
	note "Clearing parsed-auction cache"
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
		"${COMPOSE[@]}" pull tunnelquestbot
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
