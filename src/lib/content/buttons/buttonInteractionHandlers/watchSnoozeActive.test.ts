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
	unsnoozeWatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchSnoozeActive from './watchSnoozeActive';
import { unsnoozeWatch } from '../../../../prisma/dbExecutors/watch';
import { makeButtonInteraction, makeWatch } from '../../../../test/factories';
import { messageCopy } from '../../copy/messageCopy';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleWatchSnoozeActive', () => {
	beforeEach(() => {
		vi.mocked(unsnoozeWatch).mockResolvedValue(makeWatch({ id: 1 }));
	});

	it('calls unsnoozeWatch and updates with all inactive buttons', async () => {
		const metadata = makeWatch({ id: 1 });
		const interaction = makeButtonInteraction();

		await handleWatchSnoozeActive(interaction, metadata);

		expect(unsnoozeWatch).toHaveBeenCalledWith(metadata);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'WatchSnoozeInactive',
			'UnwatchInactive',
			'WatchRefreshInactive',
		]);
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.yourWatchHasBeenUnsnoozed,
		);
	});
});
