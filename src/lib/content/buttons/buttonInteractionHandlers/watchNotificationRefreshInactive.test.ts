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
	extendWatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchNotificationRefreshInactive from './watchNotificationRefreshInactive';
import { extendWatch } from '../../../../prisma/dbExecutors/watch';
import {
	makeButtonInteraction,
	makeWatch,
	makeWatchNotificationMetadata,
} from '../../../../test/factories';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleWatchNotificationRefreshInactive', () => {
	beforeEach(() => {
		vi.mocked(extendWatch).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil: null }),
		);
	});

	it('calls extendWatch and sets refresh button active', async () => {
		const metadata = makeWatchNotificationMetadata();
		const interaction = makeButtonInteraction({
			customId: 'WatchNotificationWatchRefreshInactive:1:Soandso',
		});

		await handleWatchNotificationRefreshInactive(interaction, metadata);

		expect(extendWatch).toHaveBeenCalledWith(metadata);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(actionTypes(interaction)).toEqual([
			'WatchNotificationSnoozeInactive',
			'WatchNotificationUnwatchInactive',
			'WatchBlockInactive',
			'WatchNotificationWatchRefreshActive',
		]);
	});
});
