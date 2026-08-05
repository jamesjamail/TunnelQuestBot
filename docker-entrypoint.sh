#!/bin/sh
set -e

case "$FAKE_LOGS" in
	[tT]*)
		node ./build/lib/parser/logFaker.js &
		exec npm run debug
		;;
esac

case "$DEBUG_MODE" in
	[tT]*) exec npm run debug ;;
esac

exec npm start
