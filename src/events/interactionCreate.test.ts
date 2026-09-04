import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../prisma/init', () => import('../test/mocks/prisma'));
vi.mock('../redis/init', () => import('../test/mocks/redis'));
vi.mock('../lib/content/buttons/persistentButtonHandler', () => ({
	handleButtonInteraction: vi.fn(async () => undefined),
}));

import { describe, it, expect, afterEach } from 'vitest';
import event from './interactionCreate';
import { makeChatInteraction } from '../test/factories';
import type { ChatInputCommandInteraction } from 'discord.js';

describe('interactionCreate cooldowns', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('keys cooldowns by user id instead of username', async () => {
		const interaction = makeChatInteraction();
		interaction.client.slashCommands.set('watch', {
			command: { name: 'watch' },
			cooldown: 5,
			execute: vi.fn(async () => undefined),
		});

		await event.execute(
			interaction as unknown as ChatInputCommandInteraction,
		);

		expect(interaction.client.cooldowns.has('watch-100')).toBe(true);
		expect(interaction.client.cooldowns.has('watch-tester')).toBe(false);
	});

	it('cleans up cooldown entries after the cooldown expires', async () => {
		vi.useFakeTimers();
		const interaction = makeChatInteraction();
		interaction.client.slashCommands.set('watch', {
			command: { name: 'watch' },
			cooldown: 5,
			execute: vi.fn(async () => undefined),
		});

		await event.execute(
			interaction as unknown as ChatInputCommandInteraction,
		);
		await vi.advanceTimersByTimeAsync(5001);

		expect(interaction.client.cooldowns.has('watch-100')).toBe(false);
	});

	it('does not tell the user to wait 0 seconds', async () => {
		const interaction = makeChatInteraction();
		interaction.client.slashCommands.set('watch', {
			command: { name: 'watch' },
			cooldown: 5,
			execute: vi.fn(async () => undefined),
		});
		interaction.client.cooldowns.set('watch-100', Date.now() + 400);

		await event.execute(
			interaction as unknown as ChatInputCommandInteraction,
		);

		const replyCall = vi.mocked(interaction.reply).mock.calls[0]?.[0];
		expect(String(replyCall?.content ?? '')).not.toMatch(/wait 0 second/);
	});
});
