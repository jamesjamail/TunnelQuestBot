import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	insertPlayerLinkSafely: vi.fn(async () => 'ABC123'),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './link';
import { insertPlayerLinkSafely } from '../../../prisma/dbExecutors/playerLink';
import { makeChatInteraction } from '../../../test/factories';

describe('link command', () => {
	it('replies with the link code and ooc instruction', async () => {
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(insertPlayerLinkSafely).toHaveBeenCalledWith(interaction);
		expect(interaction.reply).toHaveBeenCalledWith({
			content:
				'To link your character, send the following message in EC within one hour:\n`/ooc Link me: ABC123`',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('declares a cooldown of 300 seconds', () => {
		expect(command.cooldown).toBe(300);
	});
});
