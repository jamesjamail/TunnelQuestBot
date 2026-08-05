import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '@prisma/client';
import { authPlayerLink } from './playerLink';
import { prisma } from '../../test/mocks/prisma';

describe('authPlayerLink', () => {
	beforeEach(() => {
		vi.mocked(prisma.playerLink.update).mockReset();
	});

	it('does not update the row when the link code is expired', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockResolvedValue({
			id: 1,
			discordUserId: '100',
			server: null,
			player: null,
			linkCode: 'abc',
			linkCodeExpiry: new Date(Date.now() - 60_000),
		});

		await authPlayerLink('Soandso', Server.BLUE, 'abc');

		expect(prisma.playerLink.update).not.toHaveBeenCalled();
	});

	it('propagates unknown database errors', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockRejectedValue(
			new Error('db down'),
		);

		await expect(
			authPlayerLink('Soandso', Server.BLUE, 'abc'),
		).rejects.toThrow('db down');
	});
});
