import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';
import { parseConfig } from '../src/config';
import { join } from 'path';

const readRepoFile = (relativePath: string) =>
	readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('deployment and config invariants', () => {
	it('uses a POSIX-compatible Dockerfile CMD', () => {
		const dockerfile = readRepoFile('Dockerfile');
		expect(dockerfile).not.toMatch(/\[\[/);
	});

	it('keeps prisma available as a runtime dependency for migrate deploy', () => {
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			dependencies?: Record<string, string>;
		};
		expect(pkg.dependencies?.prisma).toBeDefined();
	});

	it('does not ship dev-only packages in dependencies', () => {
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			dependencies?: Record<string, string>;
		};
		const dependencyNames = Object.keys(pkg.dependencies ?? {});
		expect(dependencyNames.some((name) => name.startsWith('@types/'))).toBe(
			false,
		);
		expect(dependencyNames).not.toContain('concurrently');
		expect(dependencyNames).not.toContain('axios');
		expect(dependencyNames).not.toContain('node-forge');
	});

	it('indexes Watch.active for the hot active-watch scan', () => {
		const schema = readRepoFile('src/prisma/schema.prisma');
		expect(schema).toMatch(/model Watch[\s\S]*@@index\(\[active\]\)/);
	});

	it('handles Discord login rejections', () => {
		const indexSource = readRepoFile('src/index.ts');
		expect(indexSource).toMatch(/client\.login/);
		expect(indexSource).toMatch(/process\.exit\(1\)/);
	});

	it('routes uncaught exceptions through fatal shutdown', () => {
		const indexSource = readRepoFile('src/index.ts');
		expect(indexSource).toMatch(/process\.on\('uncaughtException'/);
		expect(indexSource).toMatch(/handleFatalError\(error\)/);
	});
});

describe('open-source scaffolding', () => {
	it('ships the license it claims', () => {
		//	package.json declared ISC for years with no LICENSE file, which makes
		//	the claim unenforceable and blocks some downstream users outright
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			license?: string;
		};
		expect(pkg.license).toBe('ISC');
		expect(readRepoFile('LICENSE')).toMatch(/ISC License/);
	});

	it('tells contributors how to add a command and what to run first', () => {
		const contributing = readRepoFile('CONTRIBUTING.md');
		expect(contributing).toMatch(/npm run check/);
		expect(contributing).toMatch(/Adding a slash command/);
	});

	it('schedules dependency updates, not just security ones', () => {
		//	security updates arrive without a config file; version bumps do not
		const dependabot = readRepoFile('.github/dependabot.yml');
		expect(dependabot).toMatch(/package-ecosystem:\s*npm/);
		expect(dependabot).toMatch(/package-ecosystem:\s*github-actions/);
	});
});

describe('development environment', () => {
	it('keeps TypeScript syntax erasable', () => {
		//	`enum`, `namespace` and parameter properties emit runtime code, which
		//	blocks node from type-stripping the sources. Keeping this on is what
		//	preserves the option of dropping the build step from the dev loop.
		const tsconfig = readRepoFile('tsconfig.json');
		expect(tsconfig).toMatch(/"erasableSyntaxOnly":\s*true/);
	});

	it('runs dependencies over published TCP ports for host development', () => {
		//	the production stack talks over unix sockets, which the host cannot
		//	reach; the dev override publishes ports so `npm run dev` can connect
		const override = readRepoFile('docker-compose.dev.yml');
		expect(override).toMatch(/127\.0\.0\.1:5432:5432/);
		expect(override).toMatch(/127\.0\.0\.1:6379:6379/);
	});
});

describe('lint and format config', () => {
	//	A biome.json that fails to parse does not fail the run - Biome falls back
	//	to its built-in defaults and reports success, so `npm run lint` goes green
	//	while silently linting build/ and skipping none of the excludes. Comments
	//	are the easy way to trip this, since biome.json is strict JSON.
	it('parses as strict JSON', () => {
		const raw = readRepoFile('biome.json');
		expect(() => JSON.parse(raw) as unknown).not.toThrow();
	});

	it('excludes generated and vendored trees from formatting', () => {
		const config = JSON.parse(readRepoFile('biome.json')) as {
			files?: { includes?: string[] };
		};
		const includes = config.files?.includes ?? [];

		//	Biome normalises `!build/**` to `!build`, so match the directory
		//	prefix rather than an exact glob spelling.
		for (const excluded of [
			'build',
			'src/prisma/generated',
			'src/lib/gameData',
		]) {
			expect(
				includes.some(
					(pattern) =>
						pattern.startsWith('!') &&
						pattern.slice(1).startsWith(excluded),
				),
			).toBe(true);
		}
	});

	it('has no eslint or prettier packages left to drift out of sync', () => {
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			devDependencies?: Record<string, string>;
		};
		const devDependencies = Object.keys(pkg.devDependencies ?? {});

		expect(
			devDependencies.filter(
				(name) => name.includes('eslint') || name.includes('prettier'),
			),
		).toEqual([]);
		expect(devDependencies).toContain('@biomejs/biome');
	});
});

describe('startup migration invariants', () => {
	const entrypoint = () => readRepoFile('docker-entrypoint.sh');

	it('applies migrations before starting the app', () => {
		const source = entrypoint();
		const migrateIndex = source.indexOf('prisma migrate deploy');
		const startIndex = source.indexOf('exec npm start');

		expect(migrateIndex).toBeGreaterThan(-1);
		expect(startIndex).toBeGreaterThan(migrateIndex);
	});

	it('applies migrations before the fake-log and debug branches', () => {
		const source = entrypoint();
		expect(source.indexOf('apply_migrations\n')).toBeLessThan(
			source.indexOf('$FAKE_LOGS'),
		);
		expect(source.indexOf('apply_migrations\n')).toBeLessThan(
			source.indexOf('$DEBUG_MODE'),
		);
	});

	it('retries only failures caused by an unreachable database', () => {
		const source = entrypoint();
		expect(source).toMatch(/P1001/);
		expect(source).toMatch(/MIGRATE_MAX_ATTEMPTS/);
		expect(source).toMatch(/is_retryable_failure/);
	});

	it('refuses to start the app when migrations cannot be applied', () => {
		const source = entrypoint();
		expect(source).toMatch(/migrate resolve/);
		expect(source).toMatch(/return 1/);
	});

	it('exits after the smoke check instead of starting the bot', () => {
		//	CI runs the real image against the real compose stack in this mode.
		//	It has to come after migrations (so it proves they applied) and
		//	before every branch that starts the bot.
		const source = entrypoint();
		const smokeIndex = source.indexOf('$SMOKE_TEST');

		expect(smokeIndex).toBeGreaterThan(
			source.indexOf('apply_migrations\n'),
		);
		expect(smokeIndex).toBeLessThan(source.indexOf('$FAKE_LOGS'));
		expect(source).toMatch(/exec node \.\/build\/doctor\.js/);
	});

	it('runs the smoke check in CI against the compose stack', () => {
		//	building the image proves it compiles, not that it can start
		const workflow = readRepoFile('.github/workflows/docker-build.yml');
		expect(workflow).toMatch(/SMOKE_TEST=true/);
		expect(workflow).toMatch(/docker compose run --rm/);
		expect(workflow).toMatch(/needs: \[test, integration, smoke\]/);
	});

	it('does not duplicate game data that tsc already emits into build/', () => {
		//	resolveJsonModule makes tsc copy the JSON next to the code that
		//	imports it, so the compiled require("./items.json") resolves inside
		//	build/. Copying it under /app/src as well was 600KB nothing reads.
		const dockerfile = readRepoFile('Dockerfile');
		expect(dockerfile).not.toMatch(/^COPY .*gameData.*\.json/m);
	});

	it('resolves the prisma binary locally rather than through npx', () => {
		expect(entrypoint()).toMatch(
			/\.\/node_modules\/\.bin\/prisma migrate deploy/,
		);
	});

	it('stays POSIX sh compatible', () => {
		const source = entrypoint();
		expect(source).toMatch(/^#!\/bin\/sh/);
		expect(source).not.toMatch(/\[\[/);
	});

	it('keeps the entrypoint as the only place that applies migrations', () => {
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			scripts?: Record<string, string>;
		};

		expect(pkg.scripts?.start).not.toMatch(/migrate deploy/);
		expect(pkg.scripts?.debug).not.toMatch(/migrate deploy/);
		expect(pkg.scripts?.migrate).toMatch(/migrate deploy/);
	});

	it('waits for postgres and redis to report healthy before starting', () => {
		const compose = readRepoFile('docker-compose.yml');
		expect(compose).toMatch(/pg_isready/);
		expect(compose).toMatch(/redis-cli/);
		expect(compose).toMatch(
			/depends_on:\s*\n\s*postgres:\s*\n\s*condition: service_healthy/,
		);
	});
});

//	These two guard the first-run path: a contributor copies .env.example, fills
//	in the Discord section, and runs `npm run doctor`. Both failures this covers
//	were silent - the config parsed fine in CI and in a configured checkout, and
//	only broke for someone starting from the shipped example.
describe('first-run path', () => {
	it('accepts .env.example once the Discord section is filled in', () => {
		const example = parse(readRepoFile('.env.example'));

		//	Stand in for the values a contributor supplies. Every other key in the
		//	file has to carry a default that parseConfig already accepts, which is
		//	the property under test - notably FAKE_LOGS, since the log paths are
		//	composed by compose and are absent on the host.
		for (const [key, value] of Object.entries(example)) {
			if (value !== '') continue;
			example[key] =
				key === 'TOKEN' ? 'placeholder.token' : '1'.repeat(18);
		}

		expect(() => parseConfig(example)).not.toThrow();
	});

	it('builds before running doctor, which reads from build/', () => {
		const pkg = JSON.parse(readRepoFile('package.json')) as {
			scripts?: Record<string, string>;
		};
		const doctor = pkg.scripts?.doctor ?? '';

		//	Nothing in the quickstart compiles, so a doctor script that only ran
		//	build/doctor.js failed with MODULE_NOT_FOUND on a fresh clone.
		expect(doctor).toMatch(/build\/doctor\.js/);
		expect(doctor).toMatch(/npm run build/);
	});
});
