import { vi } from 'vitest';
vi.mock(
	'../../../../index',
	() => import('../../../../test/mocks/discordClient'),
);
vi.mock(
	'../../../../prisma/init',
	() => import('../../../../test/mocks/prisma'),
);
vi.mock('../../../../redis/init', () => import('../../../../test/mocks/redis'));
vi.mock('../../../helpers/fetchHistoricalPricing', () => ({
	fetchHistoricalPricingForItem: vi.fn(async () => null),
	fetchHistoricalPricingForItems: vi.fn(async () => ({})),
}));
vi.mock('../../../../prisma/dbExecutors/watch', () => ({
	setWatchActiveByWatchId: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchNotificationUnwatchActive from './watchNotificationUnwatchActive';
import { setWatchActiveByWatchId } from '../../../../prisma/dbExecutors/watch';
import {
	makeButtonInteraction,
	makeWatch,
	makeWatchNotificationMetadata,
} from '../../../../test/factories';

describe('handleWatchNotificationUnwatchActive', () => {
	beforeEach(() => {
		vi.mocked(setWatchActiveByWatchId).mockResolvedValue(
			makeWatch({ id: 1, active: true, snoozedUntil: null }),
		);
	});

	it('uses a 3-element activeButtons array (4th refresh slot defaults inactive)', async () => {
		const metadata = makeWatchNotificationMetadata();
		const interaction = makeButtonInteraction({
			customId: 'WatchNotificationUnwatchActive:1:Soandso',
		});

		await handleWatchNotificationUnwatchActive(interaction, metadata);

		expect(setWatchActiveByWatchId).toHaveBeenCalledWith(1);
		expect(interaction.reply).not.toHaveBeenCalled();
		const payload = vi.mocked(interaction.update).mock.calls[0][0];
		// Inconsistent with sibling handlers that pass 4 booleans; documents current behavior.
		expect(payload.components[0].components).toHaveLength(4);
		expect(
			payload.components[0].components.map(
				(c: { data: { custom_id: string } }) =>
					c.data.custom_id.split(':')[0],
			),
		).toEqual([
			'WatchNotificationSnoozeInactive',
			'WatchNotificationUnwatchInactive',
			'WatchBlockInactive',
			'WatchNotificationWatchRefreshInactive',
		]);
	});
});
