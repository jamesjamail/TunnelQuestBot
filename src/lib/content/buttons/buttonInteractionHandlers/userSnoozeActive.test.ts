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
	extendAllWatchesAndReturnWatches: vi.fn(),
}));
vi.mock('../../../../prisma/dbExecutors/user', () => ({
	findOrCreateUser: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleUserSnoozeActive from './userSnoozeActive';
import { extendAllWatchesAndReturnWatches } from '../../../../prisma/dbExecutors/watch';
import { findOrCreateUser } from '../../../../prisma/dbExecutors/user';
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

describe('handleUserSnoozeActive', () => {
	beforeEach(() => {
		vi.mocked(extendAllWatchesAndReturnWatches).mockResolvedValue([
			makeWatch(),
		]);
		vi.mocked(findOrCreateUser).mockResolvedValue(makeUser());
	});

	it('calls extendAllWatchesAndReturnWatches and findOrCreateUser', async () => {
		const interaction = makeButtonInteraction({
			customId: 'UserSnoozeActive',
		});

		await handleUserSnoozeActive(interaction);

		expect(extendAllWatchesAndReturnWatches).toHaveBeenCalledWith('100');
		expect(findOrCreateUser).toHaveBeenCalledWith(interaction.user);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'UserSnoozeInactive',
			'GlobalRefreshInactive',
		]);
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.globalSnoozeHasBeenRemoved,
		);
	});
});
