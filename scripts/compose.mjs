#!/usr/bin/env node
// docker compose with the local dev version baked into the image.
// Plain `docker compose build` leaves TUNNELQUESTBOT_VERSION at its Dockerfile
// default of `dev`, because .git is not in the build context.

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { devVersion } from './dev-version.mjs';

const env = { ...process.env };
if (!env.TUNNELQUESTBOT_VERSION) {
	env.TUNNELQUESTBOT_VERSION = devVersion();
}

const result = spawnSync('docker', ['compose', ...process.argv.slice(2)], {
	env,
	stdio: 'inherit',
	shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);
