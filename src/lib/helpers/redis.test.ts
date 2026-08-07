import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));

import { describe, it, expect, beforeEach } from 'vitest';
import { generatePlayerLinkKey, getCachedPlayerDiscordName } from './redis';
import { client } from '../../test/mocks/discordClient';
import { redis } from '../../test/mocks/redis';

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
	it('scopes player link name keys by player id', () => {
		expect(generatePlayerLinkKey('99')).toBe('playerLinkName:99');
	});
});
