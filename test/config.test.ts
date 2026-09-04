import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
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

		for (const excluded of [
			'!build/**',
			'!src/prisma/generated/**',
			'!src/lib/gameData/*.json',
		]) {
			expect(includes).toContain(excluded);
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
