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
	extendWatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleWatchRefreshInactive from './watchRefreshInactive';
import { extendWatch } from '../../../../prisma/dbExecutors/watch';
import { makeButtonInteraction, makeWatch } from '../../../../test/factories';
import { messageCopy } from '../../copy/messageCopy';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleWatchRefreshInactive', () => {
	beforeEach(() => {
		vi.mocked(extendWatch).mockResolvedValue(
			makeWatch({ id: 1, snoozedUntil: null }),
		);
	});

	it('calls extendWatch and sets refresh button active', async () => {
		const metadata = makeWatch({ id: 1 });
		const interaction = makeButtonInteraction();

		await handleWatchRefreshInactive(interaction, metadata);

		expect(extendWatch).toHaveBeenCalledWith(metadata);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'WatchSnoozeInactive',
			'UnwatchInactive',
			'WatchRefreshActive',
		]);
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.yourWatchHasBeenExtended,
		);
	});
});
