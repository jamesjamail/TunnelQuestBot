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
	removePlayerBlockById: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleGlobalUnblockInactive from './globalUnblockInactive';
import { removePlayerBlockById } from '../../../../prisma/dbExecutors/block';
import {
	makeBlockedPlayer,
	makeButtonInteraction,
} from '../../../../test/factories';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components.map(
		(c: { data: { custom_id: string } }) => c.data.custom_id.split(':')[0],
	);
}

describe('handleGlobalUnblockInactive', () => {
	beforeEach(() => {
		vi.mocked(removePlayerBlockById).mockResolvedValue(makeBlockedPlayer());
	});

	it('calls removePlayerBlockById and sets unblock button active', async () => {
		const metadata = makeBlockedPlayer({ id: 5 });
		const interaction = makeButtonInteraction({
			customId: 'GlobalUnblockInactive:5',
		});

		await handleGlobalUnblockInactive(interaction, metadata);

		expect(removePlayerBlockById).toHaveBeenCalledWith(5);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual(['GlobalUnblockActive']);
	});
});
