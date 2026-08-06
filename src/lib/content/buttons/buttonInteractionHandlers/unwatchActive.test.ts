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
vi.mock('../../../../prisma/dbExecutors/watch', () => ({
	setWatchActiveByWatchId: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../../../../prisma/client';
import handleUnwatchActive from './unwatchActive';
import { setWatchActiveByWatchId } from '../../../../prisma/dbExecutors/watch';
import { makeButtonInteraction, makeWatch } from '../../../../test/factories';
import { messageCopy } from '../../copy/messageCopy';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleUnwatchActive', () => {
	beforeEach(() => {
		vi.mocked(setWatchActiveByWatchId).mockResolvedValue(
			makeWatch({ id: 1, active: true, snoozedUntil: null }),
		);
	});

	it('calls setWatchActiveByWatchId and uses original metadata in reply copy', async () => {
		const metadata = makeWatch({
			id: 1,
			itemName: 'ORIGINAL ITEM',
			server: Server.GREEN,
		});
		const interaction = makeButtonInteraction();

		await handleUnwatchActive(interaction, metadata);

		expect(setWatchActiveByWatchId).toHaveBeenCalledWith(1);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.yourWatchHasBeenRestored('ORIGINAL ITEM', Server.GREEN),
		);
		expect(actionTypes(interaction)).toEqual([
			'WatchSnoozeInactive',
			'UnwatchInactive',
			'WatchRefreshInactive',
		]);
	});
});
