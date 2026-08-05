import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { add } from 'date-fns';
import {
	authPlayerLink,
	insertPlayerLink,
	insertPlayerLinkSafely,
} from './playerLink';
import { handleLinkMatch } from '../../lib/playerLink/playerLink';
import { prisma } from '../../test/mocks/prisma';
import { client } from '../../test/mocks/discordClient';
import { makeChatInteraction, makePlayerLink } from '../../test/factories';

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

	it('links a valid unexpired code and clears linkCode fields', async () => {
		const linked = makePlayerLink({
			discordUserId: '100',
			server: Server.BLUE,
			player: 'Soandso',
			linkCode: null,
			linkCodeExpiry: null,
		});
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockResolvedValue({
			id: 1,
			discordUserId: '100',
			server: null,
			player: null,
			linkCode: 'valid-code',
			linkCodeExpiry: add(new Date(), { minutes: 30 }),
		});
		vi.mocked(prisma.playerLink.update).mockResolvedValue(linked);

		const result = await authPlayerLink(
			'Soandso',
			Server.BLUE,
			'valid-code',
		);

		expect(prisma.playerLink.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: {
				server: Server.BLUE,
				player: 'Soandso',
				linkCode: null,
				linkCodeExpiry: null,
			},
		});
		expect(result).toEqual(linked);
	});

	it('does not link an unknown code', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Not found', {
				code: 'P2025',
				clientVersion: 'test',
			}),
		);

		const result = await authPlayerLink('Soandso', Server.BLUE, 'missing');

		expect(result).toBeUndefined();
		expect(prisma.playerLink.update).not.toHaveBeenCalled();
	});

	it('does not link when the code is already tied to another server character', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockResolvedValue({
			id: 1,
			discordUserId: '100',
			server: Server.GREEN,
			player: 'Alreadylinked',
			linkCode: 'valid-code',
			linkCodeExpiry: add(new Date(), { minutes: 30 }),
		});
		vi.mocked(prisma.playerLink.update).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint', {
				code: 'P2002',
				clientVersion: 'test',
			}),
		);

		const result = await authPlayerLink(
			'Soandso',
			Server.BLUE,
			'valid-code',
		);

		expect(result).toBeUndefined();
	});
});

describe('insertPlayerLinkSafely', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
		vi.mocked(prisma.playerLink.create).mockImplementation(
			async (args) => args.data as never,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('generates a code and expiry roughly one hour out', async () => {
		const interaction = makeChatInteraction();

		const code = await insertPlayerLinkSafely(interaction);

		expect(code).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		expect(prisma.playerLink.create).toHaveBeenCalledWith({
			data: {
				discordUserId: '100',
				linkCode: code,
				linkCodeExpiry: add(new Date('2026-08-05T12:00:00Z'), {
					hours: 1,
				}),
			},
		});
	});
});

describe('insertPlayerLink', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
		vi.mocked(prisma.playerLink.create).mockImplementation(
			async (args) => args.data as never,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('creates a link code expiring one hour from now', async () => {
		await insertPlayerLink('100');

		expect(prisma.playerLink.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					discordUserId: '100',
					linkCodeExpiry: add(new Date('2026-08-05T12:00:00Z'), {
						hours: 1,
					}),
				}),
			}),
		);
	});
});

describe('handleLinkMatch', () => {
	beforeEach(() => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockReset();
		vi.mocked(prisma.playerLink.update).mockReset();
		vi.mocked(client.users.fetch).mockResolvedValue({
			send: vi.fn(async () => ({})),
		} as never);
	});

	it('sends confirmation after a successful link', async () => {
		const send = vi.fn(async () => ({}));
		vi.mocked(client.users.fetch).mockResolvedValue({ send } as never);
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockResolvedValue({
			id: 1,
			discordUserId: '100',
			server: null,
			player: null,
			linkCode: 'valid-code',
			linkCodeExpiry: add(new Date(), { minutes: 30 }),
		});
		vi.mocked(prisma.playerLink.update).mockResolvedValue(
			makePlayerLink({
				discordUserId: '100',
				server: Server.BLUE,
				player: 'Soandso',
			}),
		);

		await handleLinkMatch('Soandso', Server.BLUE, 'valid-code');

		expect(send).toHaveBeenCalledTimes(1);
	});

	it('does not send confirmation when the link code is expired', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockResolvedValue({
			id: 1,
			discordUserId: '100',
			server: null,
			player: null,
			linkCode: 'expired-code',
			linkCodeExpiry: new Date(Date.now() - 60_000),
		});

		await handleLinkMatch('Soandso', Server.BLUE, 'expired-code');

		expect(client.users.fetch).not.toHaveBeenCalled();
	});

	it('does not send confirmation for an unknown code', async () => {
		vi.mocked(prisma.playerLink.findFirstOrThrow).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Not found', {
				code: 'P2025',
				clientVersion: 'test',
			}),
		);

		await handleLinkMatch('Soandso', Server.BLUE, 'missing');

		expect(client.users.fetch).not.toHaveBeenCalled();
	});
});
