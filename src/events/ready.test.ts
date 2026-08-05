import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../prisma/init', () => import('../test/mocks/prisma'));
vi.mock('../redis/init', () => import('../test/mocks/redis'));
vi.mock('../lib/parser', () => ({
	startLoggingAllServers: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Client } from 'discord.js';
import ready from './ready';
import { initializePrisma } from '../prisma/init';
import { startLoggingAllServers } from '../lib/parser';

describe('ready event', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	it('uses the clientReady name and runs once', () => {
		expect(ready.name).toBe('clientReady');
		expect(ready.once).toBe(true);
	});

	it('execute logs the bot tag and does not throw when client.user is null', async () => {
		const client = { user: null } as Client;
		await expect(ready.execute(client)).resolves.toBeUndefined();
		expect(console.log).toHaveBeenCalled();
		expect(initializePrisma).toHaveBeenCalled();
		expect(startLoggingAllServers).toHaveBeenCalled();
	});
});
