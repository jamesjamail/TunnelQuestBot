import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));
vi.mock('../../devVersion', () => ({
	tunnelQuestVersion: (baked: string | undefined) => baked || '1.2.3-dev',
}));

import { describe, it, expect, afterEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './version';
import { gracefullyHandleError } from '../../helpers/errors';
import { makeChatInteraction } from '../../../test/factories';

describe('version command', () => {
	const originalReleaseVersion = process.env.TUNNELQUESTBOT_VERSION;
	const originalPackageVersion = process.env.npm_package_version;

	afterEach(() => {
		restoreEnv('TUNNELQUESTBOT_VERSION', originalReleaseVersion);
		restoreEnv('npm_package_version', originalPackageVersion);
	});

	it('reports the release version baked into the image', async () => {
		process.env.npm_package_version = '9.9.9';
		process.env.TUNNELQUESTBOT_VERSION = '1.4.0';
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'TunnelQuestBot version: 1.4.0',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('keeps an explicit dev build as dev', async () => {
		process.env.npm_package_version = '9.9.9';
		process.env.TUNNELQUESTBOT_VERSION = 'dev';
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'TunnelQuestBot version: dev',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('reports the latest release plus -dev when nothing was baked in', async () => {
		process.env.npm_package_version = '9.9.9';
		delete process.env.TUNNELQUESTBOT_VERSION;
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'TunnelQuestBot version: 1.2.3-dev',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('routes reply failures to gracefullyHandleError', async () => {
		const interaction = makeChatInteraction();
		const error = new Error('reply failed');
		vi.mocked(interaction.reply).mockRejectedValueOnce(error);

		await command.execute(interaction);

		expect(gracefullyHandleError).toHaveBeenCalledWith(
			error,
			interaction,
			command,
		);
	});

	it('declares a cooldown of 10 seconds', () => {
		expect(command.cooldown).toBe(10);
	});
});

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}
