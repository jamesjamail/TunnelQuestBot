import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/user', () => ({
	findOrCreateUser: vi.fn(),
}));
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchesByUser: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './list';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import { getWatchesByUser } from '../../../prisma/dbExecutors/watch';
import { messageCopy } from '../../content/copy/messageCopy';
import {
	makeChatInteraction,
	makeUser,
	makeWatch,
} from '../../../test/factories';

describe('list command', () => {
	beforeEach(() => {
		vi.mocked(findOrCreateUser).mockReset();
		vi.mocked(getWatchesByUser).mockReset();
	});

	it('replies with empty copy and no embeds when there are no watches', async () => {
		vi.mocked(findOrCreateUser).mockResolvedValue(makeUser());
		vi.mocked(getWatchesByUser).mockResolvedValue([]);
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: messageCopy.youDontHaveAnyWatches,
			flags: MessageFlags.Ephemeral,
		});
	});

	it('passes global snooze state into the first button slot', async () => {
		const snoozedUntil = new Date(Date.now() + 3600000);
		vi.mocked(findOrCreateUser).mockResolvedValue(
			makeUser({ snoozedUntil }),
		);
		vi.mocked(getWatchesByUser).mockResolvedValue([makeWatch()]);
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		const reply = vi.mocked(interaction.reply).mock.calls[0][0];
		expect(reply?.embeds?.length).toBeGreaterThan(0);
		expect(reply?.components).toHaveLength(1);
		const customId =
			reply?.components?.[0]?.components?.[0]?.toJSON?.()?.custom_id ??
			reply?.components?.[0]?.components?.[0]?.data?.custom_id;
		expect(customId).toBe('UserSnoozeActive');
	});
});
