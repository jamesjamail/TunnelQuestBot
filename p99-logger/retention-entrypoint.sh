#!/bin/sh
set -eu

max_size="${P99_JSONL_MAX_SIZE:-100M}"
rotate_count="${P99_JSONL_ROTATE_COUNT:-5}"
interval="${P99_JSONL_ROTATE_INTERVAL_SECONDS:-300}"

# Check decimal digits without shell arithmetic or its leading-zero semantics.
is_positive_integer() {
	case "$1" in
		''|*[!0-9]*) return 1 ;;
		*[1-9]*) return 0 ;;
		*) return 1 ;;
	esac
}

case "$max_size" in
	*[kKMG]) size_number="${max_size%?}" ;;
	*) size_number= ;;
esac
if ! is_positive_integer "$size_number"; then
	echo "P99_JSONL_MAX_SIZE must be a positive integer followed by k, K, M, or G, such as 100M" >&2
	exit 1
fi
case "$rotate_count" in
	''|*[!0-9]*) echo "P99_JSONL_ROTATE_COUNT must be a non-negative integer" >&2; exit 1 ;;
esac
if ! is_positive_integer "$interval"; then
	echo "P99_JSONL_ROTATE_INTERVAL_SECONDS must be a positive integer" >&2
	exit 1
fi

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
	if ! logrotate --state /tmp/logrotate.status /tmp/logrotate.conf; then
		echo "rotation pass failed; retrying next interval" >&2
	fi
	sleep "$interval"
done
