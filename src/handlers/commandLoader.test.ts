import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Collection } from 'discord.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSlashCommands, registerSlashCommands } from './commandLoader';
import { gracefullyHandleError } from '../lib/helpers/errors';

const mockPut = vi.fn();
const mockSetToken = vi.fn().mockReturnThis();

vi.mock('@discordjs/rest', () => ({
	REST: vi.fn().mockImplementation(function RESTMock() {
		return {
			setToken: mockSetToken,
			put: mockPut,
		};
	}),
}));

function makeClient() {
	return {
		slashCommands: new Collection<string, unknown>(),
	} as never;
}

function writeCommandModule(dir: string, fileName: string, name: string): void {
	writeFileSync(
		join(dir, fileName),
		`module.exports = { default: { command: { name: '${name}', toJSON: () => ({ name: '${name}' }) }, execute: async () => {} } };`,
	);
}

describe('loadSlashCommands', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'slash-commands-'));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('loads .js files and skips .ts, .d.ts, and _-prefixed files', () => {
		writeCommandModule(tempDir, 'watch.js', 'watch');
		writeFileSync(join(tempDir, 'watch.ts'), 'export {};');
		writeFileSync(join(tempDir, 'watch.d.ts'), 'export {};');
		writeFileSync(
			join(tempDir, '_hidden.js'),
			'throw new Error("should not load hidden command");',
		);

		const client = makeClient();
		const commands = loadSlashCommands(tempDir, client);

		expect(commands).toHaveLength(1);
		expect(commands[0].toJSON()).toEqual({ name: 'watch' });
		expect(client.slashCommands.get('watch')).toBeDefined();
	});

	it('returns an empty array when every file is skipped', () => {
		writeFileSync(join(tempDir, 'watch.ts'), 'export {};');
		writeFileSync(
			join(tempDir, '_hidden.js'),
			'throw new Error("should not load hidden command");',
		);
		writeFileSync(join(tempDir, 'help.d.ts'), 'export {};');

		const client = makeClient();
		expect(loadSlashCommands(tempDir, client)).toEqual([]);
		expect(client.slashCommands.size).toBe(0);
	});

	it('registers each loaded command under command.command.name', () => {
		writeCommandModule(tempDir, 'watch.js', 'watch');
		writeCommandModule(tempDir, 'help.js', 'help');

		const client = makeClient();
		loadSlashCommands(tempDir, client);

		expect(client.slashCommands.has('watch')).toBe(true);
		expect(client.slashCommands.has('help')).toBe(true);
	});

	it('throws when a module default export is missing', () => {
		writeFileSync(join(tempDir, 'bad.js'), 'module.exports = {};');

		const client = makeClient();
		expect(() => loadSlashCommands(tempDir, client)).toThrow();
	});
});

describe('registerSlashCommands', () => {
	beforeEach(() => {
		mockPut.mockReset();
		mockSetToken.mockClear();
		process.env.TOKEN = 'test-token';
		process.env.CLIENT_ID = 'client-id';
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('logs the count when rest.put resolves', async () => {
		mockPut.mockResolvedValue([{}, {}]);

		await registerSlashCommands([
			{ toJSON: () => ({ name: 'watch' }) } as never,
		]);

		expect(mockSetToken).toHaveBeenCalledWith('test-token');
		expect(mockPut).toHaveBeenCalled();
		expect(console.log).toHaveBeenCalled();
	});

	it('routes a rejected rest.put to gracefullyHandleError without rethrowing', async () => {
		const error = new Error('discord api down');
		mockPut.mockRejectedValue(error);

		await expect(
			registerSlashCommands([
				{ toJSON: () => ({ name: 'watch' }) } as never,
			]),
		).resolves.toBeUndefined();
		expect(gracefullyHandleError).toHaveBeenCalledWith(error);
	});
});
