import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('./errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Interaction } from 'discord.js';
import {
	generateButtonInteractionKey,
	generatePlayerLinkKey,
	getCachedPlayerDiscordName,
	isDuplicateButtonInteraction,
} from './redis';
import { gracefullyHandleError } from './errors';
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
			generateButtonInteractionKey('i-1'),
			'acknowledged',
			'EX',
			15,
			'NX',
		);
		expect(redis.setnx).not.toHaveBeenCalled();

		expect(await isDuplicateButtonInteraction(interaction)).toBe(true);
		expect(gracefullyHandleError).toHaveBeenCalled();
	});
});

describe('getCachedPlayerDiscordName', () => {
	beforeEach(() => {
		vi.mocked(client.users.fetch).mockResolvedValue({
			username: 'testuser',
		} as never);
	});

	it('returns the cached value on a hit without fetching the user', async () => {
		await redis.set(
			generatePlayerLinkKey('42'),
			'cached-name',
			'EX',
			7 * 24 * 60 * 60,
		);

		const name = await getCachedPlayerDiscordName('42');

		expect(name).toBe('cached-name');
		expect(client.users.fetch).not.toHaveBeenCalled();
	});

	it('resolves through the client on a miss and caches the username', async () => {
		const name = await getCachedPlayerDiscordName('42');

		expect(name).toBe('testuser');
		expect(client.users.fetch).toHaveBeenCalledWith('42');
		expect(redis.set).toHaveBeenCalledWith(
			generatePlayerLinkKey('42'),
			'testuser',
			'EX',
			7 * 24 * 60 * 60,
		);
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

	it('propagates redis rejections rather than degrading silently', async () => {
		vi.mocked(redis.get).mockRejectedValueOnce(new Error('redis down'));

		await expect(getCachedPlayerDiscordName('42')).rejects.toThrow(
			'redis down',
		);
	});
});

describe('redis key helpers', () => {
	it('scopes button interaction keys by interaction id', () => {
		expect(generateButtonInteractionKey('abc')).toBe(
			'buttonInteraction:abc',
		);
	});

	it('scopes player link name keys by player id', () => {
		expect(generatePlayerLinkKey('99')).toBe('playerLinkName:99');
	});
});
