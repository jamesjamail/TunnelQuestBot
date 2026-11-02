#!/bin/sh
# Print the semver image tag for a release tag or version.
# A leading v is removed. Build metadata is rejected: '+' cannot appear in an
# image tag, and package.json is not a version source.
set -eu

if [ "$#" -ne 1 ]; then
	echo "usage: release-version.sh <tag-or-version>" >&2
	exit 2
fi

tag=$1
case $tag in
	v*) version=${tag#v} ;;
	*) version=$tag ;;
esac

if ! printf '%s\n' "$version" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$'; then
	echo "not a semver release: $tag" >&2
	exit 1
fi

printf '%s\n' "$version"
