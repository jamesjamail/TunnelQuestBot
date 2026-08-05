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
	addPlayerBlockByWatch: vi.fn(),
}));
vi.mock('../../../../prisma/dbExecutors/watch', () => ({
	getWatchByWatchId: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchBlockInactive from './watchBlockInactive';
import { addPlayerBlockByWatch } from '../../../../prisma/dbExecutors/block';
import { getWatchByWatchId } from '../../../../prisma/dbExecutors/watch';
import {
	makeBlockedPlayerByWatch,
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

describe('handleWatchBlockInactive', () => {
	beforeEach(() => {
		vi.mocked(addPlayerBlockByWatch).mockResolvedValue(
			makeBlockedPlayerByWatch(),
		);
		vi.mocked(getWatchByWatchId).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil: null }),
		);
	});

	it('rejects when metadata is missing user', async () => {
		const metadata = makeWatchNotificationMetadata();
		delete (metadata as { user?: unknown }).user;
		const interaction = makeButtonInteraction({
			customId: 'WatchBlockInactive:1:Soandso',
		});

		await expect(
			handleWatchBlockInactive(interaction, metadata),
		).rejects.toThrow();
		expect(addPlayerBlockByWatch).not.toHaveBeenCalled();
		expect(interaction.update).not.toHaveBeenCalled();
	});

	it('calls addPlayerBlockByWatch and reflects snoozed state from getWatchByWatchId', async () => {
		const snoozedUntil = new Date(Date.now() + 60_000);
		const metadata = makeWatchNotificationMetadata({ player: 'Soandso' });
		vi.mocked(getWatchByWatchId).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil }),
		);
		const interaction = makeButtonInteraction({
			customId: 'WatchBlockInactive:1:Soandso',
		});

		await handleWatchBlockInactive(interaction, metadata);

		expect(addPlayerBlockByWatch).toHaveBeenCalledWith('100', 1, 'Soandso');
		expect(getWatchByWatchId).toHaveBeenCalledWith(1);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(actionTypes(interaction)).toEqual([
			'WatchNotificationSnoozeActive',
			'WatchNotificationUnwatchInactive',
			'WatchBlockActive',
			'WatchNotificationWatchRefreshInactive',
		]);
	});
});
