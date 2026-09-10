import { vi } from 'vitest';
vi.mock('./init', () => import('../test/mocks/prisma'));
import { describe, it, expect, beforeEach } from 'vitest';
import { attemptAndCreateUserIfNeeded } from './higherOrderFunctions';
import { prisma } from '../test/mocks/prisma';
import { makeChatInteraction } from '../test/factories';

describe('attemptAndCreateUserIfNeeded', () => {
	beforeEach(() => {
		vi.mocked(prisma.user.upsert).mockReset();
	});
	it('ensures the user exists before running the action', async () => {
		const interaction = makeChatInteraction();
		const action = vi.fn(async () => {
			expect(prisma.user.upsert).toHaveBeenCalledWith({
				where: { discordUserId: interaction.user.id },
				update: {},
				create: {
					discordUserId: interaction.user.id,
					discordUsername: interaction.user.username,
				},
			});
			return 'ok';
		});
		await expect(
			attemptAndCreateUserIfNeeded(interaction, action),
		).resolves.toBe('ok');
		expect(action).toHaveBeenCalledTimes(1);
	});
	it('does not run the action if the user cannot be ensured', async () => {
		const error = new Error('database unavailable');
		vi.mocked(prisma.user.upsert).mockRejectedValue(error);
		const action = vi.fn();
		await expect(
			attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
		).rejects.toBe(error);
		expect(action).not.toHaveBeenCalled();
	});
	it.each(['P2002', 'P2003', undefined])(
		'propagates action errors without retrying (%s)',
		async (code) => {
			const error = Object.assign(new Error('failure'), { code });
			const action = vi.fn().mockRejectedValue(error);
			await expect(
				attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
			).rejects.toBe(error);
			expect(action).toHaveBeenCalledTimes(1);
		},
	);
});
