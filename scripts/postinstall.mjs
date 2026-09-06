#!/usr/bin/env node
//	Generates the Prisma client after `npm install`.
//
//	src/prisma/generated is gitignored, so a fresh clone has no client until
//	`prisma generate` runs. Only `npm run build` did that, which meant
//	`npm install && npm run dev` - the documented quickstart - dropped a new
//	contributor into ~70 TypeScript errors that look like a broken repository
//	rather than a missing build step.
//
//	Guarded rather than a plain `"postinstall": "prisma generate"` because the
//	Dockerfile runs `npm ci` before `COPY src/`, so at that point there is no
//	schema to generate from and an unguarded call fails the image build.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const SCHEMA = 'src/prisma/schema.prisma';

if (!existsSync(SCHEMA)) {
	//	Dependency-only install (the Docker build stage). Nothing to generate.
	process.exit(0);
}

try {
	//	via npx rather than a bare `prisma`: npm puts node_modules/.bin on PATH
	//	for lifecycle scripts, but running this file directly does not, and the
	//	bare form then fails with a confusing ENOENT.
	execFileSync('npx', ['prisma', 'generate'], {
		stdio: 'inherit',
		shell: process.platform === 'win32',
	});
} catch {
	//	A failure here must not fail `npm install` — the developer still has a
	//	working checkout, and `npm run build` will surface the real error with
	//	better context than a postinstall trace.
	console.warn(
		'\n[postinstall] prisma generate failed. Run `npm run generate` before' +
			' `npm run dev` if you see missing-module errors from src/prisma/client.\n',
	);
}
