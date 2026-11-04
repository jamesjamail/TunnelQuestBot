#!/usr/bin/env node
// Local version string: the highest semver tag in this checkout, plus -dev.
// Release images set TUNNELQUESTBOT_VERSION and never call this. package.json
// is not a version source.

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

/**
 * @param {string} tag
 * @returns {string | null}
 */
export function normalizeReleaseTag(tag) {
	const bare = tag.startsWith('v') ? tag.slice(1) : tag;
	return SEMVER.test(bare) ? bare : null;
}

/**
 * @param {string} version
 * @returns {{ nums: number[], pre: string | null }}
 */
function parseSemver(version) {
	const match = SEMVER.exec(version);
	if (!match) throw new Error(`not semver: ${version}`);
	return {
		nums: [Number(match[1]), Number(match[2]), Number(match[3])],
		pre: match[4] ?? null,
	};
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareSemver(left, right) {
	const a = parseSemver(left);
	const b = parseSemver(right);
	for (let i = 0; i < 3; i++) {
		if (a.nums[i] !== b.nums[i]) return a.nums[i] - b.nums[i];
	}
	if (a.pre === null && b.pre !== null) return 1;
	if (a.pre !== null && b.pre === null) return -1;
	if (a.pre === null || b.pre === null) return 0;

	const aParts = a.pre.split('.');
	const bParts = b.pre.split('.');
	const length = Math.max(aParts.length, bParts.length);
	for (let i = 0; i < length; i++) {
		if (aParts[i] === undefined) return -1;
		if (bParts[i] === undefined) return 1;
		const aNum = /^[0-9]+$/.test(aParts[i]);
		const bNum = /^[0-9]+$/.test(bParts[i]);
		if (aNum && bNum) {
			const diff = Number(aParts[i]) - Number(bParts[i]);
			if (diff !== 0) return diff;
			continue;
		}
		if (aNum !== bNum) return aNum ? -1 : 1;
		if (aParts[i] !== bParts[i]) return aParts[i] < bParts[i] ? -1 : 1;
	}
	return 0;
}

/**
 * @param {string[]} tags
 * @returns {string}
 */
export function devVersionFromTags(tags) {
	const versions = tags
		.map((tag) => normalizeReleaseTag(tag.trim()))
		.filter((version) => version !== null);
	if (versions.length === 0) return 'dev';
	versions.sort(compareSemver);
	return `${versions[versions.length - 1]}-dev`;
}

export function devVersion() {
	try {
		const output = execFileSync('git', ['tag', '--merged', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		return devVersionFromTags(output.split(/\r?\n/));
	} catch {
		return 'dev';
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.stdout.write(`${devVersion()}\n`);
}
