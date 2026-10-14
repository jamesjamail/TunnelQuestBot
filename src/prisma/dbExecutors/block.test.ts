import { vi } from 'vitest';
vi.mock('../init', () => import('../../test/mocks/prisma'));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../client';
import {
	addPlayerBlock,
	addTraderBlock,
	getHiddenTraders,
	hideTrader,
	removePlayerBlockWithoutServer,
	removeTraderBlock,
	unhideTrader,
} from './block';
import { prisma } from '../../test/mocks/prisma';
import { makeBlockedPlayer, makeChatInteraction } from '../../test/factories';

describe('addPlayerBlock', () => {
	beforeEach(() => {
		vi.mocked(prisma.blockedPlayer.upsert).mockResolvedValue(
			makeBlockedPlayer(),
		);
	});

	it('reactivates a previously soft-deleted block on upsert update', async () => {
		await addPlayerBlock('100', 'soandso', Server.BLUE);

		expect(prisma.blockedPlayer.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				update: expect.objectContaining({ active: true }),
			}),
		);
	});
});

describe('removePlayerBlockWithoutServer', () => {
	it('queries blocked players using an uppercased player name', async () => {
		vi.mocked(prisma.blockedPlayer.findFirstOrThrow).mockResolvedValue(
			makeBlockedPlayer({ id: 5 }),
		);
		vi.mocked(prisma.blockedPlayer.update).mockResolvedValue(
			makeBlockedPlayer({ id: 5, active: false }),
		);

		const interaction = makeChatInteraction();
		await removePlayerBlockWithoutServer(interaction, 'soandso');

		expect(prisma.blockedPlayer.findFirstOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ player: 'SOANDSO' }),
			}),
		);
	});
});

describe('addTraderBlock', () => {
	it('upserts on the blocker/blocked pair so a repeat block is a no-op', async () => {
		await addTraderBlock('100', '200');

		expect(prisma.blockedTrader.upsert).toHaveBeenCalledWith({
			where: {
				discordUserId_blockedDiscordUserId: {
					discordUserId: '100',
					blockedDiscordUserId: '200',
				},
			},
			update: {},
			create: { discordUserId: '100', blockedDiscordUserId: '200' },
		});
	});
});

describe('removeTraderBlock', () => {
	it('returns how many blocks were removed', async () => {
		vi.mocked(prisma.blockedTrader.deleteMany).mockResolvedValue({
			count: 1,
		});

		expect(await removeTraderBlock('100', '200')).toBe(1);
		expect(prisma.blockedTrader.deleteMany).toHaveBeenCalledWith({
			where: { discordUserId: '100', blockedDiscordUserId: '200' },
		});
	});

	it('returns 0 when there was no block', async () => {
		vi.mocked(prisma.blockedTrader.deleteMany).mockResolvedValue({
			count: 0,
		});

		expect(await removeTraderBlock('100', '200')).toBe(0);
	});
});

describe('hideTrader', () => {
	it('upserts on the viewer/hidden pair so a repeat hide is a no-op', async () => {
		await hideTrader('100', '200');

		expect(prisma.hiddenTrader.upsert).toHaveBeenCalledWith({
			where: {
				discordUserId_hiddenDiscordUserId: {
					discordUserId: '100',
					hiddenDiscordUserId: '200',
				},
			},
			update: {},
			create: { discordUserId: '100', hiddenDiscordUserId: '200' },
		});
	});
});

describe('unhideTrader', () => {
	it('returns how many hides were removed', async () => {
		vi.mocked(prisma.hiddenTrader.deleteMany).mockResolvedValue({
			count: 1,
		});

		expect(await unhideTrader('100', '200')).toBe(1);
		expect(prisma.hiddenTrader.deleteMany).toHaveBeenCalledWith({
			where: { discordUserId: '100', hiddenDiscordUserId: '200' },
		});
	});

	it('returns 0 when the trader was not hidden', async () => {
		vi.mocked(prisma.hiddenTrader.deleteMany).mockResolvedValue({
			count: 0,
		});

		expect(await unhideTrader('100', '200')).toBe(0);
	});
});

describe('getHiddenTraders', () => {
	it('attaches a username where the hidden trader has a user row', async () => {
		vi.mocked(prisma.hiddenTrader.findMany).mockResolvedValue([
			{ hiddenDiscordUserId: '200' },
			{ hiddenDiscordUserId: '300' },
		] as never);
		vi.mocked(prisma.user.findMany).mockResolvedValue([
			{ discordUserId: '200', discordUsername: 'Ogrelord' },
		] as never);

		expect(await getHiddenTraders('100')).toEqual([
			{ hiddenDiscordUserId: '200', discordUsername: 'Ogrelord' },
			{ hiddenDiscordUserId: '300', discordUsername: undefined },
		]);
		expect(prisma.hiddenTrader.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { discordUserId: '100' } }),
		);
	});
});
