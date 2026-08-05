import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Interaction } from 'discord.js';
import {
	getCachedPlayerDiscordName,
	isDuplicateButtonInteraction,
} from './redis';
import { client } from '../../test/mocks/discordClient';
import { redis } from '../../test/mocks/redis';

describe('isDuplicateButtonInteraction', () => {
	it('uses atomic SET EX NX for dedupe keys', async () => {
		const interaction = {
			id: 'i-1',
			channelId: null,
			user: { id: '100' },
		} as unknown as Interaction;

		expect(await isDuplicateButtonInteraction(interaction)).toBe(false);
		expect(redis.set).toHaveBeenCalledWith(
			'buttonInteraction:i-1',
			expect.any(String),
			'EX',
			expect.any(Number),
			'NX',
		);
		expect(redis.setnx).not.toHaveBeenCalled();

		expect(await isDuplicateButtonInteraction(interaction)).toBe(true);
	});
});

describe('getCachedPlayerDiscordName', () => {
	beforeEach(() => {
		vi.mocked(client.users.fetch).mockResolvedValue({
			username: 'testuser',
		} as never);
	});

	it('stores the username with an EX TTL in the same SET call', async () => {
		await getCachedPlayerDiscordName('42');

		expect(redis.set).toHaveBeenCalledWith(
			'playerLinkName:42',
			'testuser',
			'EX',
			7 * 24 * 60 * 60,
		);
		expect(redis.expire).not.toHaveBeenCalled();
	});
});
