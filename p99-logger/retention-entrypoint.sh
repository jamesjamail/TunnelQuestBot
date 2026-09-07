#!/bin/sh
set -eu

max_size="${P99_JSONL_MAX_SIZE:-100M}"
rotate_count="${P99_JSONL_ROTATE_COUNT:-5}"
interval="${P99_JSONL_ROTATE_INTERVAL_SECONDS:-300}"

case "$max_size" in
	*[kKmMgG]) size_number="${max_size%?}" ;;
	*) size_number="$max_size" ;;
esac
case "$size_number" in
	''|*[!0-9]*) echo "P99_JSONL_MAX_SIZE must be a size such as 100M" >&2; exit 1 ;;
esac
case "$rotate_count" in
	''|*[!0-9]*) echo "P99_JSONL_ROTATE_COUNT must be a non-negative integer" >&2; exit 1 ;;
esac
case "$interval" in
	''|*[!0-9]*|0) echo "P99_JSONL_ROTATE_INTERVAL_SECONDS must be a positive integer" >&2; exit 1 ;;
esac

cat > /tmp/logrotate.conf <<EOF
/data/green/chat.jsonl /data/blue/chat.jsonl {
	size $max_size
	rotate $rotate_count
	missingok
	notifempty
	copytruncate
	compress
}
EOF

echo "JSONL retention active: check every ${interval}s, rotate at ${max_size}, keep ${rotate_count} compressed archives"

while true; do
	logrotate --state /tmp/logrotate.status /tmp/logrotate.conf
	sleep "$interval"
done
