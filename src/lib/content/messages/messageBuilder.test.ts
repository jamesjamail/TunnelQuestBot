import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../helpers/fetchHistoricalPricing', () => ({
	fetchHistoricalPricingForItem: vi.fn(async () => null),
	fetchHistoricalPricingForItems: vi.fn(async () => ({})),
}));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	getPlayerLink: vi.fn(async () => null),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '@prisma/client';
import {
	embeddedAuctionStreamMessageBuilder,
	listCommandResponseBuilder,
	watchCommandResponseBuilder,
	watchNotificationBuilder,
	HistoricalData,
} from './messageBuilder';
import {
	fetchHistoricalPricingForItem,
	fetchHistoricalPricingForItems,
} from '../../helpers/fetchHistoricalPricing';
import { getPlayerLink } from '../../../prisma/dbExecutors/playerLink';
import {
	makeUser,
	makeWatch,
	makeWatchWithUser,
} from '../../../test/factories';

describe('embeddedAuctionStreamMessageBuilder', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItems).mockResolvedValue({});
	});

	it('chunks item fields across embeds when there are more than 25 items', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS lots of stuff',
			{
				selling: Array.from({ length: 30 }, (_, i) => ({
					item: `ITEM ${i}`,
				})),
				buying: [],
			},
		);

		for (const embed of embeds) {
			expect((embed.toJSON().fields ?? []).length).toBeLessThanOrEqual(
				25,
			);
		}
		expect(embeds.length).toBeLessThanOrEqual(10);
		const totalFields = embeds.reduce(
			(sum, embed) => sum + (embed.toJSON().fields ?? []).length,
			0,
		);
		expect(totalFields).toBe(30);
	});
});

describe('listCommandResponseBuilder', () => {
	it('does not produce embeds with empty fields and respects the 25-field limit', () => {
		const blueWatches = Array.from({ length: 30 }, (_, i) =>
			makeWatch({
				id: i + 1,
				server: Server.BLUE,
				itemName: `BLUE ITEM ${i}`,
			}),
		);
		const greenWatches = Array.from({ length: 5 }, (_, i) =>
			makeWatch({
				id: 100 + i,
				server: Server.GREEN,
				itemName: `GREEN ITEM ${i}`,
			}),
		);

		const embeds = listCommandResponseBuilder(
			[...blueWatches, ...greenWatches],
			makeUser(),
		);

		for (const embed of embeds) {
			const fields = embed.toJSON().fields ?? [];
			expect(fields.length).toBeGreaterThan(0);
			expect(fields.length).toBeLessThanOrEqual(25);
		}
	});
});

describe('notes field length', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItem).mockResolvedValue(null);
	});

	it('truncates long notes in watchCommandResponseBuilder', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ notes: 'x'.repeat(2000) }),
		);
		for (const field of embed.toJSON().fields ?? []) {
			expect(field.value?.length ?? 0).toBeLessThanOrEqual(1024);
		}
	});

	it('truncates long notes in watchNotificationBuilder', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({ notes: 'x'.repeat(2000) }),
			'Soandso',
			100,
			'msg',
		);
		for (const field of embed.toJSON().fields ?? []) {
			expect(field.value?.length ?? 0).toBeLessThanOrEqual(1024);
		}
	});
});

describe('historical pricing display', () => {
	it('renders a zero average as a price rather than a dash', async () => {
		const historicalData: HistoricalData = {
			eQitemId: 1,
			itemName: 'ITEM 0',
			server: 0,
			lastWTBSeen: null,
			lastWTSSeen: null,
			totalWTSAuctionCount: 0,
			totalWTSAuctionAverage: 0,
			totalWTSLast30DaysCount: 12,
			totalWTSLast30DaysAverage: 0,
			totalWTSLast60DaysCount: 0,
			totalWTSLast60DaysAverage: 0,
			totalWTSLast90DaysCount: 0,
			totalWTSLast90DaysAverage: 0,
			totalWTSLast6MonthsCount: 0,
			totalWTSLast6MonthsAverage: 0,
			totalWTSLastYearCount: 0,
			totalWTSLastYearAverage: 0,
			totalWTBAuctionCount: 0,
			totalWTBAuctionAverage: 0,
			totalWTBLast30DaysCount: 0,
			totalWTBLast30DaysAverage: 0,
			totalWTBLast60DaysCount: 0,
			totalWTBLast60DaysAverage: 0,
			totalWTBLast90DaysCount: 0,
			totalWTBLast90DaysAverage: 0,
			totalWTBLast6MonthsCount: 0,
			totalWTBLast6MonthsAverage: 0,
			totalWTBLastYearCount: 0,
			totalWTBLastYearAverage: 0,
		};
		vi.mocked(fetchHistoricalPricingForItems).mockResolvedValue({
			'ITEM 0': historicalData,
		});

		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS ITEM 0',
			{ selling: [{ item: 'ITEM 0' }], buying: [] },
		);

		const allValues = embeds.flatMap((embed) =>
			(embed.toJSON().fields ?? []).map((field) => field.value ?? ''),
		);
		expect(allValues.some((value) => value.includes('Avg: -'))).toBe(false);
	});
});

describe('watchNotificationBuilder player link mention', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItem).mockResolvedValue(null);
	});

	it('formats the player link mention without a stray slash', async () => {
		vi.mocked(getPlayerLink).mockResolvedValue({
			id: 1,
			discordUserId: '42',
			server: Server.BLUE,
			player: 'Soandso',
			linkCode: null,
			linkCodeExpiry: null,
		});

		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			undefined,
			'msg',
		);

		const description = embed.toJSON().description ?? '';
		expect(description).toContain('**Soandso** (<@42>)');
		expect(description).not.toContain('/<@42>');
	});
});
