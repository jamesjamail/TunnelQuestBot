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
vi.mock('../../../../prisma/dbExecutors/block', () => ({
	removeWatchBlockByPlayerName: vi.fn(),
}));
vi.mock('../../../../prisma/dbExecutors/watch', () => ({
	getWatchByWatchId: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchBlockActive from './watchBlockActive';
import { removeWatchBlockByPlayerName } from '../../../../prisma/dbExecutors/block';
import { getWatchByWatchId } from '../../../../prisma/dbExecutors/watch';
import {
	makeBlockedPlayerByWatch,
	makeButtonInteraction,
	makeWatch,
	makeWatchNotificationMetadata,
} from '../../../../test/factories';

describe('handleWatchBlockActive', () => {
	beforeEach(() => {
		vi.mocked(removeWatchBlockByPlayerName).mockResolvedValue(
			makeBlockedPlayerByWatch(),
		);
		vi.mocked(getWatchByWatchId).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil: null }),
		);
	});

	it('updates components only without embeds', async () => {
		const metadata = makeWatchNotificationMetadata({ player: 'Soandso' });
		const interaction = makeButtonInteraction({
			customId: 'WatchBlockActive:1:Soandso',
		});

		await handleWatchBlockActive(interaction, metadata);

		expect(removeWatchBlockByPlayerName).toHaveBeenCalledWith(1, 'Soandso');
		expect(interaction.reply).not.toHaveBeenCalled();
		const payload = vi.mocked(interaction.update).mock.calls[0][0];
		expect(payload).not.toHaveProperty('embeds');
		expect(payload.components).toBeDefined();
	});
});
