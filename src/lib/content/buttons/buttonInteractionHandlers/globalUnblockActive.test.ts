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
	restorePlayerBlockById: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import handleGlobalUnblockActive from './globalUnblockActive';
import { restorePlayerBlockById } from '../../../../prisma/dbExecutors/block';
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

describe('handleGlobalUnblockActive', () => {
	beforeEach(() => {
		vi.mocked(restorePlayerBlockById).mockResolvedValue(
			makeBlockedPlayer(),
		);
	});

	it('calls restorePlayerBlockById and sets unblock button inactive', async () => {
		const metadata = makeBlockedPlayer({ id: 5 });
		const interaction = makeButtonInteraction({
			customId: 'GlobalUnblockActive:5',
		});

		await handleGlobalUnblockActive(interaction, metadata);

		expect(restorePlayerBlockById).toHaveBeenCalledWith(5);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual(['GlobalUnblockInactive']);
	});
});
