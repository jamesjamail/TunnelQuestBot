import { vi } from 'vitest';
vi.mock('./init', () => import('../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { attemptAndCreateUserIfNeeded } from './higherOrderFunctions';
import { prisma } from '../test/mocks/prisma';
import { makeChatInteraction } from '../test/factories';

//	Prisma has relocated the violated-constraint detail between major versions.
//	Each shape below shipped in a real release; missing one means lazy user
//	creation stops working and the user's first command fails.
function fkError(overrides: Record<string, unknown>) {
	return Object.assign(new Error('Foreign key constraint violated'), {
		code: 'P2003',
		...overrides,
	});
}

const SHAPES: Array<[string, Error]> = [
	[
		'Prisma 7 driver adapter constraint index',
		fkError({
			meta: {
				driverAdapterError: {
					cause: {
						constraint: { index: 'Watch_discordUserId_fkey' },
					},
				},
			},
		}),
	],
	[
		'Prisma 7 driver adapter constraint fields',
		fkError({
			meta: {
				driverAdapterError: {
					cause: { constraint: { fields: ['discordUserId'] } },
				},
			},
		}),
	],
];

describe('attemptAndCreateUserIfNeeded', () => {
	beforeEach(() => {
		vi.mocked(prisma.user.upsert).mockClear();
	});

	it.each(SHAPES)('creates the user and retries for %s', async (_, error) => {
		const action = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('ok');

		const result = await attemptAndCreateUserIfNeeded(
			makeChatInteraction(),
			action,
		);

		expect(result).toBe('ok');
		expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
		expect(action).toHaveBeenCalledTimes(2);
	});

	it('does not create a user when the action succeeds', async () => {
		const action = vi.fn(async () => 'ok');

		await expect(
			attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
		).resolves.toBe('ok');
		expect(prisma.user.upsert).not.toHaveBeenCalled();
	});

	it('rethrows a P2003 raised by an unrelated foreign key', async () => {
		const error = fkError({
			message:
				'Foreign key constraint violated on the constraint: `BlockedPlayerByWatch_watchId_fkey`',
			meta: {
				driverAdapterError: {
					cause: {
						constraint: {
							index: 'BlockedPlayerByWatch_watchId_fkey',
						},
					},
				},
			},
		});
		const action = vi.fn().mockRejectedValue(error);

		await expect(
			attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
		).rejects.toBe(error);
		expect(prisma.user.upsert).not.toHaveBeenCalled();
		expect(action).toHaveBeenCalledTimes(1);
	});

	it('rethrows non-P2003 errors untouched', async () => {
		const error = Object.assign(new Error('nope'), { code: 'P2002' });
		const action = vi.fn().mockRejectedValue(error);

		await expect(
			attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
		).rejects.toBe(error);
		expect(prisma.user.upsert).not.toHaveBeenCalled();
	});

	it('rethrows non-object throws without inspecting them', async () => {
		const action = vi.fn().mockRejectedValue('a bare string');

		await expect(
			attemptAndCreateUserIfNeeded(makeChatInteraction(), action),
		).rejects.toBe('a bare string');
		expect(prisma.user.upsert).not.toHaveBeenCalled();
	});
});
