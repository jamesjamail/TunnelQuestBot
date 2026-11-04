import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './help';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';
import { makeChatInteraction } from '../../../test/factories';

describe('help command', () => {
	it('replies with help copy and ephemeral flag', async () => {
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		const sent = [
			...vi.mocked(interaction.reply).mock.calls,
			...vi.mocked(interaction.followUp).mock.calls,
		].map(([options]) => options as { content: string; flags: number });
		expect(sent.every((m) => m.flags === MessageFlags.Ephemeral)).toBe(
			true,
		);
		expect(sent.map((m) => m.content).join('\n\n')).toBe(
			messageCopy.helpMsg.trimStart(),
		);
	});

	it("keeps every message within Discord's 2000 character limit", async () => {
		const interaction = makeChatInteraction();

		await command.execute(interaction);

		const sent = [
			...vi.mocked(interaction.reply).mock.calls,
			...vi.mocked(interaction.followUp).mock.calls,
		].map(([options]) => (options as { content: string }).content);
		expect(sent.length).toBeGreaterThan(1);
		for (const content of sent) {
			expect(content.length).toBeLessThanOrEqual(2000);
		}
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
