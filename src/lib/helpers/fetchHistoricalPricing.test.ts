import { vi } from 'vitest';
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@prisma/client';
import { fetchHistoricalPricingForItem } from './fetchHistoricalPricing';
import { redis } from '../../test/mocks/redis';

describe('fetchHistoricalPricingForItem', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({ itemName: 'FBSS' }),
			})),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('stores historical pricing in redis with a TTL', async () => {
		await fetchHistoricalPricingForItem('FBSS', Server.BLUE);

		const cacheSetCall = vi
			.mocked(redis.set)
			.mock.calls.find(([key]) => key === 'historical:BLUE:FBSS');

		expect(cacheSetCall).toBeDefined();
		expect(cacheSetCall?.slice(2)).toEqual(
			expect.arrayContaining(['EX', expect.any(Number)]),
		);
	});

	it.skip('sends the numeric server id the pricing API expects', () => {
		// Enable after confirming BLUE/GREEN/RED -> int mapping against live API.
	});
});
