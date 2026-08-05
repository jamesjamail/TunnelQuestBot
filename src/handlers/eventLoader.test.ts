import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEvents } from './eventLoader';

function makeClient() {
	return {
		on: vi.fn(),
		once: vi.fn(),
	} as never;
}

function writeEventModule(
	dir: string,
	fileName: string,
	name: string,
	once: boolean,
): void {
	writeFileSync(
		join(dir, fileName),
		`module.exports = { default: { name: '${name}', once: ${once}, execute: async () => {} } };`,
	);
}

describe('loadEvents', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'events-'));
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers once events with client.once and others with client.on', () => {
		writeEventModule(tempDir, 'ready.js', 'clientReady', true);
		writeEventModule(tempDir, 'interaction.js', 'interactionCreate', false);

		const client = makeClient();
		const loaded = loadEvents(tempDir, client);

		expect(loaded.sort()).toEqual(['clientReady', 'interactionCreate']);
		expect(client.once).toHaveBeenCalledWith(
			'clientReady',
			expect.any(Function),
		);
		expect(client.on).toHaveBeenCalledWith(
			'interactionCreate',
			expect.any(Function),
		);
	});

	it('registers nothing for an empty directory', () => {
		const client = makeClient();
		expect(loadEvents(tempDir, client)).toEqual([]);
		expect(client.on).not.toHaveBeenCalled();
		expect(client.once).not.toHaveBeenCalled();
	});
});
