import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect } from 'vitest';

async function getRedis() {
	const { redis } = await import('../../redis/init');
	return redis;
}

describe('redis helpers (integration)', () => {
	it('SET key value EX 15 NX returns OK then null', async () => {
		const redis = await getRedis();
		const key = 'itest:nx-once';

		expect(await redis.set(key, 'value', 'EX', 15, 'NX')).toBe('OK');
		expect(await redis.set(key, 'value', 'EX', 15, 'NX')).toBeNull();
	});

	it('concurrent SET EX NX calls produce exactly one winner', async () => {
		const redis = await getRedis();
		const key = 'itest:nx-race';

		const results = await Promise.all([
			redis.set(key, 'a', 'EX', 15, 'NX'),
			redis.set(key, 'b', 'EX', 15, 'NX'),
		]);

		const winners = results.filter((result) => result === 'OK');
		expect(winners).toHaveLength(1);
	});

	it('a key written with EX 1 expires after real waiting', async () => {
		const redis = await getRedis();
		const key = 'itest:ttl';

		await redis.set(key, 'value', 'EX', 1);
		expect(await redis.get(key)).toBe('value');

		await new Promise((resolve) => setTimeout(resolve, 1100));
		expect(await redis.get(key)).toBeNull();
	});

	it('flushall between tests leaves no keys from prior tests', async () => {
		const redis = await getRedis();

		expect(await redis.keys('*')).toEqual([]);
	});
});
