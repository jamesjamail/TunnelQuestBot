import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, afterEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './version';
import { gracefullyHandleError } from '../../helpers/errors';
import { makeChatInteraction } from '../../../test/factories';

describe('version command', () => {
	const originalVersion = process.env.npm_package_version;

	afterEach(() => {
		process.env.npm_package_version = originalVersion;
	});

	it('includes npm_package_version in the reply', async () => {
		process.env.npm_package_version = '1.2.3';
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'TunnelQuestBot version: 1.2.3',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('renders undefined when npm_package_version is absent', async () => {
		delete process.env.npm_package_version;
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'TunnelQuestBot version: undefined',
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
