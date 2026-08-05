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
	snoozeWatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchNotificationSnoozeInactive from './watchNotificationSnoozeInactive';
import { snoozeWatch } from '../../../../prisma/dbExecutors/watch';
import {
	makeButtonInteraction,
	makeWatch,
	makeWatchNotificationMetadata,
} from '../../../../test/factories';

function buttonCount(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.length;
}

describe('handleWatchNotificationSnoozeInactive', () => {
	beforeEach(() => {
		vi.mocked(snoozeWatch).mockResolvedValue(makeWatch({ id: 1 }));
	});

	it('calls snoozeWatch and rebuilds the notification embed from metadata', async () => {
		const metadata = makeWatchNotificationMetadata({
			player: 'Soandso',
			auctionMessage: 'WTS FBSS 100pp',
		});
		const interaction = makeButtonInteraction({
			customId: 'WatchNotificationSnoozeInactive:1:Soandso',
		});

		await handleWatchNotificationSnoozeInactive(interaction, metadata);

		expect(snoozeWatch).toHaveBeenCalledWith(metadata);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(buttonCount(interaction)).toBe(4);
		const embedDescription = vi.mocked(interaction.update).mock.calls[0][0]
			.embeds[0].data.description;
		expect(embedDescription).toContain('Soandso');
		expect(embedDescription).toContain('WTS FBSS 100pp');
	});
});
