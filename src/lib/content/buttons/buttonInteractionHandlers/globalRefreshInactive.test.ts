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
	extendAllWatchesAndReturnUserAndWatches: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleGlobalRefreshInactive from './globalRefreshInactive';
import { extendAllWatchesAndReturnUserAndWatches } from '../../../../prisma/dbExecutors/watch';
import {
	makeButtonInteraction,
	makeUser,
	makeWatch,
} from '../../../../test/factories';
import { messageCopy } from '../../copy/messageCopy';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleGlobalRefreshInactive', () => {
	beforeEach(() => {
		vi.mocked(extendAllWatchesAndReturnUserAndWatches).mockResolvedValue({
			watches: [makeWatch()],
			user: makeUser(),
		});
	});

	it('extends all watches without metadata and renders the list embed', async () => {
		const interaction = makeButtonInteraction({
			customId: 'GlobalRefreshInactive',
		});

		await handleGlobalRefreshInactive(interaction);

		expect(extendAllWatchesAndReturnUserAndWatches).toHaveBeenCalledWith(
			'100',
		);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'UserSnoozeInactive',
			'GlobalRefreshActive',
		]);
		expect(
			vi.mocked(interaction.update).mock.calls[0][0].embeds,
		).toHaveLength(1);
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.globalSnoozeHasBeenRemoved,
		);
	});
});
