#!/bin/sh
set -eu

interval="${METABASE_SNAPSHOT_INTERVAL_SECONDS:-300}"
case "$interval" in
	''|*[!0-9]*|0)
		echo "METABASE_SNAPSHOT_INTERVAL_SECONDS must be a positive integer" >&2
		exit 1
		;;
esac

echo "Metabase SQLite snapshot loop: every ${interval}s"

while true; do
	if [ ! -s /data/tunnelquestbot.db ]; then
		echo "source database missing or empty; retrying in ${interval}s" >&2
		sleep "$interval"
		continue
	fi

	if ! node <<'NODE'
const Database = require('better-sqlite3');
const fs = require('fs');

(async () => {
  const source = new Database('/data/tunnelquestbot.db', { readonly: true });
  if (source.pragma('quick_check', { simple: true }) !== 'ok') {
    throw new Error('source integrity check failed');
  }
  const temporary = '/snapshots/tunnelquestbot.db.tmp';
  const destination = '/snapshots/tunnelquestbot.db';
  fs.rmSync(temporary, { force: true });
  await source.backup(temporary);
  source.close();

  const backup = new Database(temporary, { readonly: true });
  const integrity = backup.pragma('quick_check', { simple: true });
  backup.close();
  if (integrity !== 'ok') throw new Error('snapshot integrity check failed');

  fs.renameSync(temporary, destination);
  fs.chmodSync(destination, 0o644);
  console.log(`Snapshot refreshed: ${destination}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
	then
		echo "snapshot failed; retrying in ${interval}s" >&2
	fi
	sleep "$interval"
done
