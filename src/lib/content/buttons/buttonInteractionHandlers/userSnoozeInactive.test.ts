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
	snoozeAllWatchesAndReturnWatchesAndUser: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleUserSnoozeInactive from './userSnoozeInactive';
import { snoozeAllWatchesAndReturnWatchesAndUser } from '../../../../prisma/dbExecutors/watch';
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

describe('handleUserSnoozeInactive', () => {
	beforeEach(() => {
		vi.mocked(snoozeAllWatchesAndReturnWatchesAndUser).mockResolvedValue({
			watches: [makeWatch()],
			user: makeUser(),
		});
	});

	it('calls snoozeAllWatchesAndReturnWatchesAndUser and renders snoozed list buttons', async () => {
		const interaction = makeButtonInteraction({
			customId: 'UserSnoozeInactive',
		});

		await handleUserSnoozeInactive(interaction);

		expect(snoozeAllWatchesAndReturnWatchesAndUser).toHaveBeenCalledWith(
			'100',
		);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'UserSnoozeActive',
			'GlobalRefreshInactive',
		]);
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.allYourWatchesHaveBeenSnoozed(),
		);
	});
});
