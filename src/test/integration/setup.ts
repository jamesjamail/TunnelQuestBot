import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

let postgres: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

// 	Env vars the app reads at import time. Set before any src/ module loads.
process.env.WIKI_BASE_URL = 'https://wiki.example.com';
process.env.IMAGE_BUCKET_URL = 'https://img.example.com/';
process.env.WATCH_DURATION_IN_DAYS = '7';
(globalThis as Record<string, unknown>).DEBUG_MODE = false;
(globalThis as Record<string, unknown>).debug_console = () => {};

beforeAll(async () => {
	postgres = await new PostgreSqlContainer('postgres:18-alpine')
		.withDatabase('tunnelquestbot_test')
		.withUsername('test')
		.withPassword('test')
		.start();
	redisContainer = await new RedisContainer('redis:alpine').start();

	process.env.DATABASE_URL = postgres.getConnectionUri();
	process.env.REDIS_URL = redisContainer.getConnectionUrl();

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

	await postgres?.stop();
	await redisContainer?.stop();
});

beforeEach(async () => {
	const { prisma } = await import('../../prisma/init');
	await prisma.$executeRawUnsafe(
		'TRUNCATE TABLE "BlockedPlayerByWatch", "BlockedPlayer", "PlayerLink", "Watch", "User" RESTART IDENTITY CASCADE',
	);
	const { redis } = await import('../../redis/init');
	await redis.flushall();
});
