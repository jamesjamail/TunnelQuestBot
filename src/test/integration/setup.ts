import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { resetConfigCache } from '../../config';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
	RedisContainer,
	type StartedRedisContainer,
} from '@testcontainers/redis';
import { applyTestEnvironment } from '../env';

let databaseDirectory: string;
let redisContainer: StartedRedisContainer;

// 	Env vars the app reads at import time. Set before any src/ module loads.
// 	Shared with the unit setup so config()'s required set can only be satisfied
// 	in one place - these two drifted apart once already.
applyTestEnvironment();

beforeAll(async () => {
	databaseDirectory = mkdtempSync(join(tmpdir(), 'tqb-sqlite-'));
	if (!process.env.TEST_REDIS_URL) {
		redisContainer = await new RedisContainer('redis:alpine').start();
	}

	process.env.DATABASE_URL = `file:${join(databaseDirectory, 'test.db')}`;
	process.env.REDIS_URL =
		process.env.TEST_REDIS_URL ?? redisContainer.getConnectionUrl();

	// 	config() memoised the placeholder DATABASE_URL if anything read it
	// 	before the container was up
	resetConfigCache();
	vi.resetModules();

	execSync('npx prisma migrate deploy', {
		env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
		stdio: 'inherit',
	});
});

afterAll(async () => {
	// 	Close the clients first. ioredis reconnects on its own, so a container
	// 	pulled out from under a live connection logs errors during teardown and
	// 	makes a passing run look like a failing one.
	const [{ redis }, { prisma }] = await Promise.all([
		import('../../redis/init'),
		import('../../prisma/init'),
	]);
	await redis.quit();
	await prisma.$disconnect();

	rmSync(databaseDirectory, { recursive: true, force: true });
	await redisContainer?.stop();
});

beforeEach(async () => {
	const { prisma } = await import('../../prisma/init');
	await prisma.$transaction([
		prisma.blockedPlayerByWatch.deleteMany(),
		prisma.blockedPlayer.deleteMany(),
		prisma.playerLink.deleteMany(),
		prisma.watch.deleteMany(),
		prisma.user.deleteMany(),
		prisma.dataMigration.deleteMany(),
	]);
	await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence');
	const { redis } = await import('../../redis/init');
	await redis.flushall();
});
