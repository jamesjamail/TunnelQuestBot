import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../prisma/init', () => import('../test/mocks/prisma'));
vi.mock('../redis/init', () => import('../test/mocks/redis'));
vi.mock('../lib/parser', () => ({
	startLoggingAllServers: vi.fn(async () => undefined),
}));
vi.mock('../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Client } from 'discord.js';
import ready, { initializeRuntime } from './ready';
import { initializePrisma } from '../prisma/init';
import { startLoggingAllServers } from '../lib/parser';
import { gracefullyHandleError } from '../lib/helpers/errors';

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

	it('retries transient startup failures before succeeding', async () => {
		vi.mocked(startLoggingAllServers)
			.mockRejectedValueOnce(new Error('database unavailable'))
			.mockResolvedValueOnce(undefined);
		const sleep = vi.fn(async () => undefined);

		await initializeRuntime({ maxAttempts: 3, sleep });

		expect(initializePrisma).toHaveBeenCalledTimes(2);
		expect(startLoggingAllServers).toHaveBeenCalledTimes(2);
		expect(gracefullyHandleError).toHaveBeenCalledTimes(1);
		expect(sleep).toHaveBeenCalledWith(1000);
	});

	it('rethrows after a configured startup attempt limit', async () => {
		const error = new Error('database unavailable');
		vi.mocked(initializePrisma).mockRejectedValue(error);
		const sleep = vi.fn(async () => undefined);

		await expect(initializeRuntime({ maxAttempts: 3, sleep })).rejects.toBe(
			error,
		);

		expect(initializePrisma).toHaveBeenCalledTimes(3);
		expect(gracefullyHandleError).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});
});
