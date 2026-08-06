import { vi } from 'vitest';
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('./errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '../../prisma/client';
import {
	fetchHistoricalPricingForItem,
	fetchHistoricalPricingForItems,
} from './fetchHistoricalPricing';
import { gracefullyHandleError } from './errors';
import { redis } from '../../test/mocks/redis';

const pricingPayload = {
	eQitemId: 1,
	itemName: 'FBSS',
	server: 0,
	lastWTBSeen: null,
	lastWTSSeen: null,
	totalWTSAuctionCount: 0,
	totalWTSAuctionAverage: 0,
	totalWTSLast30DaysCount: 12,
	totalWTSLast30DaysAverage: 100,
	totalWTSLast60DaysCount: 0,
	totalWTSLast60DaysAverage: 0,
	totalWTSLast90DaysCount: 0,
	totalWTSLast90DaysAverage: 0,
	totalWTBAuctionCount: 0,
	totalWTBAuctionAverage: 0,
	totalWTBLast30DaysCount: 0,
	totalWTBLast30DaysAverage: 0,
	totalWTBLast60DaysCount: 0,
	totalWTBLast60DaysAverage: 0,
	totalWTBLast90DaysCount: 0,
	totalWTBLast90DaysAverage: 0,
};

describe('fetchHistoricalPricingForItem', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => pricingPayload,
			})),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns parsed pricing for a 200 response', async () => {
		const result = await fetchHistoricalPricingForItem('FBSS', Server.BLUE);

		expect(result).toEqual(pricingPayload);
	});

	it('returns null for a 204 response', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 204,
		} as Response);

		await expect(
			fetchHistoricalPricingForItem('FBSS', Server.BLUE),
		).resolves.toBeNull();
	});

	it('returns null for a non-OK response and logs the failure', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 500,
		} as Response);

		await expect(
			fetchHistoricalPricingForItem('FBSS', Server.BLUE),
		).resolves.toBeNull();

		expect(consoleError).toHaveBeenCalledWith(
			500,
			expect.stringContaining('/api/item/get/BLUE/FBSS'),
		);
		expect(gracefullyHandleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('rejects when fetch rejects', async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

		await expect(
			fetchHistoricalPricingForItem('FBSS', Server.BLUE),
		).rejects.toThrow('network down');
	});

	it('rejects when response JSON is malformed', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => {
				throw new Error('invalid json');
			},
		} as Response);

		await expect(
			fetchHistoricalPricingForItem('FBSS', Server.BLUE),
		).rejects.toThrow('invalid json');
	});

	it('skips fetch on a cache hit', async () => {
		await redis.set(
			'historical:BLUE:FBSS',
			JSON.stringify(pricingPayload),
			'EX',
			60 * 60 * 6,
		);

		const result = await fetchHistoricalPricingForItem('FBSS', Server.BLUE);

		expect(result).toEqual(pricingPayload);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('stores historical pricing in redis with a TTL on cache miss', async () => {
		await fetchHistoricalPricingForItem('FBSS', Server.BLUE);

		const cacheSetCall = vi
			.mocked(redis.set)
			.mock.calls.find(([key]) => key === 'historical:BLUE:FBSS');

		expect(cacheSetCall).toBeDefined();
		expect(cacheSetCall?.[2]).toBe('EX');
		expect(cacheSetCall?.[3]).toBe(60 * 60 * 6);
	});

	it('uses the Prisma Server enum value in the pricing API URL', async () => {
		await fetchHistoricalPricingForItem('FBSS', Server.GREEN);

		expect(fetch).toHaveBeenCalledWith(
			'https://pricing.example.com/api/item/get/GREEN/FBSS',
		);
	});
});

describe('fetchHistoricalPricingForItems', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => ({
				ok: true,
				status: 200,
				json: async () => ({
					...pricingPayload,
					itemName: String(url).split('/').pop(),
				}),
			})),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches each item and preserves input order in the result object', async () => {
		const results = await fetchHistoricalPricingForItems(
			{
				buying: [{ item: 'ALPHA' }, { item: 'BETA' }],
				selling: [{ item: 'GAMMA' }],
			},
			Server.BLUE,
		);

		expect(Object.keys(results)).toEqual(['ALPHA', 'BETA', 'GAMMA']);
		expect(results.ALPHA).toEqual(
			expect.objectContaining({ itemName: 'ALPHA' }),
		);
		expect(results.BETA).toEqual(
			expect.objectContaining({ itemName: 'BETA' }),
		);
		expect(results.GAMMA).toEqual(
			expect.objectContaining({ itemName: 'GAMMA' }),
		);
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
