import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
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

	//	These match the handler bodies rather than the whole file. The earlier
	//	spelling asserted `process.exit(1)` appeared somewhere in index.ts, which
	//	four unrelated call sites also satisfy - so it passed whether or not the
	//	login rejection was the thing being handled.
	it('exits rather than idling when the login finally fails', () => {
		const indexSource = readRepoFile('src/index.ts');

		expect(indexSource).toMatch(
			/login\(\)\.catch\(\(error\) => \{[\s\S]*?process\.exit\(1\);[\s\S]*?\}\)/,
		);
	});

	it('routes uncaught exceptions through fatal shutdown', () => {
		const indexSource = readRepoFile('src/index.ts');

		expect(indexSource).toMatch(
			/process\.on\('uncaughtException',[\s\S]*?handleFatalError\(error\)/,
		);
	});

	it('does not start the bot merely because a module imported it', () => {
		//	Six modules import `client` from index.ts, errors.ts among them. While
		//	startup ran at module scope, importing any of them opened a gateway
		//	connection and re-registered slash commands against the live app.
		const indexSource = readRepoFile('src/index.ts');

		expect(indexSource).toMatch(
			/if \(require\.main === module\) \{\s*boot\(\);\s*\}/,
		);
		expect(indexSource).toMatch(/function boot\(\)[\s\S]*?login\(\)/);
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

	//	Runs the real shell function rather than asserting on its text, so the
	//	classification is checked rather than the spelling of the case arms.
	function isRetryable(message: string): boolean {
		const fn = entrypoint().match(
			/^is_retryable_failure\(\) \{[\s\S]*?^\}/m,
		)?.[0];
		if (!fn)
			throw new Error('is_retryable_failure not found in entrypoint');

		const script = `${fn}\nif is_retryable_failure "$1"; then echo yes; else echo no; fi`;
		return (
			execFileSync('sh', ['-c', script, 'sh', message], {
				encoding: 'utf8',
			}).trim() === 'yes'
		);
	}

	it('waits for a database that is not up yet', () => {
		expect(isRetryable("P1001 Can't reach database server")).toBe(true);
		expect(isRetryable('connect ECONNREFUSED 127.0.0.1:5432')).toBe(true);
	});

	it('fails fast on a missing file rather than retrying it', () => {
		//	ENOENT means schema.prisma or migrations/ is absent from the image,
		//	which is exactly what the smoke job exists to catch. It used to retry
		//	thirty times at 2s before failing, burying the reason.
		expect(isRetryable('ENOENT: no such file or directory')).toBe(false);
	});

	it('fails fast on a migration that needs a person', () => {
		expect(isRetryable('P3009 migrate found failed migrations')).toBe(
			false,
		);
	});

	it('bounds the retrying', () => {
		expect(entrypoint()).toMatch(/MIGRATE_MAX_ATTEMPTS/);
	});

	it('refuses to start the app when migrations cannot be applied', () => {
		const source = entrypoint();
		expect(source).toMatch(/migrate resolve/);
		expect(source).toMatch(/return 1/);
	});

	it('exits after the smoke check instead of starting the bot', () => {
		//	CI runs the real image against the real compose stack in this mode.
		//	It has to come after migrations (so it proves they applied) and
		//	after synchronous fake-log setup, before any branch starts the bot.
		const source = entrypoint();
		const smokeIndex = source.indexOf('$SMOKE_TEST');

		expect(smokeIndex).toBeGreaterThan(
			source.indexOf('apply_migrations\n'),
		);
		expect(smokeIndex).toBeGreaterThan(
			source.indexOf('logFaker.js --once'),
		);
		expect(smokeIndex).toBeLessThan(source.lastIndexOf('$FAKE_LOGS'));
		expect(source).toMatch(/exec node \.\/build\/doctor\.js/);
	});

	it('runs the smoke check in CI against the compose stack', () => {
		//	building the image proves it compiles, not that it can start
		const workflow = readRepoFile('.github/workflows/docker-build.yml');
		expect(workflow).toMatch(
			/uses: \.\/\.github\/workflows\/container\.yml/,
		);
		const smoke = readRepoFile('scripts/ci-smoke.sh');
		expect(smoke).toMatch(/SMOKE_TEST=true/);
		expect(smoke).toMatch(/compose run --rm/);
		expect(workflow).toMatch(/needs: \[test, integration\]/);
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

	it('bounds container logs and rotates collector JSONL files', () => {
		const compose = readRepoFile('docker-compose.yml');
		const retention = readRepoFile('p99-logger/retention-entrypoint.sh');

		expect(compose).toMatch(/driver: local/);
		expect(compose).toMatch(/DOCKER_LOG_MAX_SIZE:-10m/);
		expect(compose).toMatch(/DOCKER_LOG_MAX_FILES:-5/);
		expect(compose).toMatch(/p99-log-retention:/);
		expect(compose).toMatch(/P99_JSONL_MAX_SIZE:-100M/);
		expect(retention).toMatch(/copytruncate/);
		expect(retention).toMatch(/compress/);
		expect(retention).toMatch(
			/\/data\/green\/chat\.jsonl \/data\/blue\/chat\.jsonl/,
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

		expect(() => parseConfig(example as NodeJS.ProcessEnv)).not.toThrow();
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
