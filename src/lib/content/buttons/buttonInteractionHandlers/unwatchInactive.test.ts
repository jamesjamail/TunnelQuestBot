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
	unwatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleUnwatchInactive from './unwatchInactive';
import { unwatch } from '../../../../prisma/dbExecutors/watch';
import { makeButtonInteraction, makeWatch } from '../../../../test/factories';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleUnwatchInactive', () => {
	it('reflects snoozed state and active unwatch slot when watch is snoozed', async () => {
		const snoozedUntil = new Date(Date.now() + 60_000);
		vi.mocked(unwatch).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil, active: false }),
		);
		const interaction = makeButtonInteraction();

		await handleUnwatchInactive(interaction, makeWatch({ id: 1 }));

		expect(unwatch).toHaveBeenCalledOnce();
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(actionTypes(interaction)).toEqual([
			'WatchSnoozeActive',
			'UnwatchActive',
			'WatchRefreshInactive',
		]);
	});

	it('reflects unsnoozed state and active unwatch slot when watch is not snoozed', async () => {
		vi.mocked(unwatch).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil: null, active: false }),
		);
		const interaction = makeButtonInteraction();

		await handleUnwatchInactive(interaction, makeWatch({ id: 1 }));

		expect(actionTypes(interaction)).toEqual([
			'WatchSnoozeInactive',
			'UnwatchActive',
			'WatchRefreshInactive',
		]);
	});
});
