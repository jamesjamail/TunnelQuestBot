import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	removeTraderBlock: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import command from './unblocktrader';
import { removeTraderBlock } from '../../../prisma/dbExecutors/block';
import { makeChatInteraction } from '../../../test/factories';

function interactionTargeting(targetId: string) {
	return makeChatInteraction({
		options: { getUser: vi.fn(() => ({ id: targetId })) },
	});
}

describe('unblocktrader command', () => {
	it('confirms when a block was removed', async () => {
		vi.mocked(removeTraderBlock).mockResolvedValue(1);
		const interaction = interactionTargeting('200');

		await command.execute(interaction);

		expect(removeTraderBlock).toHaveBeenCalledWith('100', '200');
		expect(vi.mocked(interaction.reply).mock.calls[0][0]).toMatchObject({
			content: expect.stringContaining('has been unblocked'),
		});
	});

	it('says so when there was no block to remove', async () => {
		vi.mocked(removeTraderBlock).mockResolvedValue(0);
		const interaction = interactionTargeting('200');

		await command.execute(interaction);

		expect(vi.mocked(interaction.reply).mock.calls[0][0]).toMatchObject({
			content: expect.stringContaining("haven't blocked"),
		});
	});
});
