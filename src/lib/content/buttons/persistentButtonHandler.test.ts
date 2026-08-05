import { vi } from 'vitest';

const mockHandlers = vi.hoisted(() => ({
	handleWatchSnoozeInactive: vi.fn(async () => undefined),
	handleWatchSnoozeActive: vi.fn(async () => undefined),
	handleUnwatchInactive: vi.fn(async () => undefined),
	handleUnwatchActive: vi.fn(async () => undefined),
	handleWatchRefreshInactive: vi.fn(async () => undefined),
	handleGlobalRefreshInactive: vi.fn(async () => undefined),
	handleUserSnoozeInactive: vi.fn(async () => undefined),
	handleUserSnoozeActive: vi.fn(async () => undefined),
	handleGlobalUnblockInactive: vi.fn(async () => undefined),
	handleGlobalUnblockActive: vi.fn(async () => undefined),
	handleUnlinkCharacterInactive: vi.fn(async () => undefined),
	handleUnlinkCharacterActive: vi.fn(async () => undefined),
	handleWatchBlockInactive: vi.fn(async () => undefined),
	handleWatchBlockActive: vi.fn(async () => undefined),
	handleWatchNotificationSnoozeInactive: vi.fn(async () => undefined),
	handleWatchNotificationSnoozeActive: vi.fn(async () => undefined),
	handleWatchNotificationUnwatchInactive: vi.fn(async () => undefined),
	handleWatchNotificationUnwatchActive: vi.fn(async () => undefined),
	handleWatchNotificationRefreshInactive: vi.fn(async () => undefined),
}));

vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('./buttonInteractionHandlers/index', () => mockHandlers);
vi.mock('../../../prisma/dbExecutors/watch', () => ({
	getWatchByWatchId: vi.fn(),
	getWatchByWatchIdForWatchNotification: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import { Server } from '@prisma/client';
import {
	extractNotificationContext,
	handleButtonInteraction,
} from './persistentButtonHandler';
import {
	getWatchByWatchId,
	getWatchByWatchIdForWatchNotification,
} from '../../../prisma/dbExecutors/watch';
import { prisma } from '../../../test/mocks/prisma';
import {
	makeButtonInteraction,
	makePlayerLink,
	makeWatchWithUser,
} from '../../../test/factories';

describe('extractNotificationContext', () => {
	it('returns safe defaults when embeds are empty', () => {
		const interaction = {
			message: { embeds: [] },
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction)).toEqual({
			player: 'Unknown',
			price: undefined,
			auctionMessage: '',
		});
	});

	it('parses suffixed prices like 3.5k into numeric platinum values', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'\n\n\n**Soandso** is currently selling **Fbss** for **3.5k** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 3.5k``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction)).toEqual({
			player: 'Soandso',
			price: 3500,
			auctionMessage: 'WTS FBSS 3.5k',
		});
	});

	it('parses plain pp prices', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Soandso** is currently selling **Fbss** for **500pp** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 500pp``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).price).toBe(500);
	});

	it('parses million-suffixed prices', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Soandso** is currently selling **Fbss** for **2m** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 2m``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).price).toBe(2_000_000);
	});

	it('parses comma-separated pp prices', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Soandso** is currently selling **Fbss** for **1,500pp** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 1,500pp``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).price).toBe(1500);
	});

	it('returns undefined price when no price is present', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Soandso** is currently selling **Fbss** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).price).toBeUndefined();
	});

	it('extracts the player name from the embed description', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Merchant** is currently selling **Fbss** for **100pp** on **Project 1999 Blue Server**\n\n``Merchant auctions, WTS FBSS 100pp``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).player).toBe('Merchant');
	});
});

describe('handleButtonInteraction', () => {
	beforeEach(() => {
		Object.values(mockHandlers).forEach((fn) => fn.mockClear());
	});

	it('routes WatchSnoozeInactive to handleWatchSnoozeInactive with fetched watch', async () => {
		const watch = makeWatchWithUser({ id: 1 });
		vi.mocked(getWatchByWatchId).mockResolvedValue(watch);
		const interaction = makeButtonInteraction({
			customId: 'WatchSnoozeInactive:1',
		});

		await handleButtonInteraction(interaction);

		expect(getWatchByWatchId).toHaveBeenCalledWith(1);
		expect(mockHandlers.handleWatchSnoozeInactive).toHaveBeenCalledWith(
			interaction,
			watch,
		);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).not.toHaveBeenCalled();
	});

	it('returns silently for unknown action types', async () => {
		const interaction = makeButtonInteraction({
			customId: 'NotARealButton:1',
		});

		await handleButtonInteraction(interaction);

		Object.values(mockHandlers).forEach((fn) =>
			expect(fn).not.toHaveBeenCalled(),
		);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).not.toHaveBeenCalled();
	});

	it('replies ephemerally when an entity id is required but missing', async () => {
		const interaction = makeButtonInteraction({
			customId: 'WatchSnoozeInactive',
		});

		await handleButtonInteraction(interaction);

		expect(mockHandlers.handleWatchSnoozeInactive).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content:
				'This item no longer exists. It may have been deleted or expired.',
			flags: MessageFlags.Ephemeral,
		});
		expect(interaction.update).not.toHaveBeenCalled();
	});

	it.each([
		['UserSnoozeInactive', 'handleUserSnoozeInactive'],
		['GlobalRefreshInactive', 'handleGlobalRefreshInactive'],
		['GlobalUnblockInactive', 'handleGlobalUnblockInactive'],
	] as const)(
		'allows entity-free prefix %s without metadata',
		async (customId, handlerKey) => {
			const interaction = makeButtonInteraction({ customId });

			await handleButtonInteraction(interaction);

			expect(mockHandlers[handlerKey]).toHaveBeenCalledWith(
				interaction,
				undefined,
			);
			expect(interaction.reply).not.toHaveBeenCalled();
		},
	);

	it('passes block id metadata for GlobalUnblock when an id is present', async () => {
		const interaction = makeButtonInteraction({
			customId: 'GlobalUnblockInactive:7',
		});

		await handleButtonInteraction(interaction);

		expect(mockHandlers.handleGlobalUnblockInactive).toHaveBeenCalledWith(
			interaction,
			{ id: 7 },
		);
	});

	it('replies ephemerally when fetchMetadata throws', async () => {
		vi.mocked(getWatchByWatchId).mockRejectedValue(new Error('db down'));
		const interaction = makeButtonInteraction({
			customId: 'WatchSnoozeInactive:1',
		});

		await handleButtonInteraction(interaction);

		expect(mockHandlers.handleWatchSnoozeInactive).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content:
				'This item no longer exists. It may have been deleted or expired.',
			flags: MessageFlags.Ephemeral,
		});
	});

	it('passes player extra and watch notification metadata for WatchBlockInactive', async () => {
		const watch = makeWatchWithUser({ id: 1 });
		vi.mocked(getWatchByWatchIdForWatchNotification).mockResolvedValue(
			watch,
		);
		const interaction = makeButtonInteraction({
			customId: 'WatchBlockInactive:1:Soandso',
			message: {
				embeds: [
					{
						description:
							'**Fallback** is currently selling **Fbss** for **100pp** on **Project 1999 Blue Server**\n\n``Fallback auctions, WTS FBSS 100pp``',
					},
				],
			},
		});

		await handleButtonInteraction(interaction);

		expect(getWatchByWatchIdForWatchNotification).toHaveBeenCalledWith(1);
		expect(mockHandlers.handleWatchBlockInactive).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({
				id: 1,
				player: 'Soandso',
				user: watch.user,
				blockedWatches: watch.blockedWatches,
				price: 100,
				auctionMessage: 'WTS FBSS 100pp',
			}),
		);
	});

	it('returns prisma playerLink rows for UnlinkCharacterInactive', async () => {
		const link = makePlayerLink({ id: 1 });
		vi.mocked(prisma.playerLink.findUnique).mockResolvedValue(link);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
		});

		await handleButtonInteraction(interaction);

		expect(prisma.playerLink.findUnique).toHaveBeenCalledWith({
			where: { id: 1 },
		});
		expect(mockHandlers.handleUnlinkCharacterInactive).toHaveBeenCalledWith(
			interaction,
			link,
		);
	});

	it('reconstructs PlayerLink from embed title when lookup returns null', async () => {
		vi.mocked(prisma.playerLink.findUnique).mockResolvedValue(null);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
			message: { embeds: [{ title: 'Soandso (BLUE)' }] },
		});

		await handleButtonInteraction(interaction);

		expect(mockHandlers.handleUnlinkCharacterInactive).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({
				id: 1,
				player: 'Soandso',
				server: Server.BLUE,
				discordUserId: '100',
			}),
		);
	});

	it('reconstructs PlayerLink from prefixed embed title', async () => {
		vi.mocked(prisma.playerLink.findUnique).mockResolvedValue(null);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
			message: { embeds: [{ title: '⛓️‍💥 Soandso (BLUE)' }] },
		});

		await handleButtonInteraction(interaction);

		expect(mockHandlers.handleUnlinkCharacterInactive).toHaveBeenCalledWith(
			interaction,
			expect.objectContaining({
				player: 'Soandso',
				server: Server.BLUE,
			}),
		);
	});

	it('returns null metadata for unparseable unlink embed titles', async () => {
		vi.mocked(prisma.playerLink.findUnique).mockResolvedValue(null);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
			message: { embeds: [{ title: 'Not a valid title' }] },
		});

		await handleButtonInteraction(interaction);

		expect(
			mockHandlers.handleUnlinkCharacterInactive,
		).not.toHaveBeenCalled();
		expect(interaction.reply).toHaveBeenCalledWith({
			content:
				'This item no longer exists. It may have been deleted or expired.',
			flags: MessageFlags.Ephemeral,
		});
	});

	// Refresh is idempotent — both Active and Inactive customIds route to the
	// same handler because toggling refresh state would be a no-op.
	it('routes both refresh states to the single idempotent refresh handler', async () => {
		const watch = makeWatchWithUser({ id: 1 });
		vi.mocked(getWatchByWatchId).mockResolvedValue(watch);

		for (const customId of [
			'WatchRefreshInactive:1',
			'WatchRefreshActive:1',
		]) {
			mockHandlers.handleWatchRefreshInactive.mockClear();
			const interaction = makeButtonInteraction({ customId });

			await handleButtonInteraction(interaction);

			expect(
				mockHandlers.handleWatchRefreshInactive,
			).toHaveBeenCalledWith(interaction, watch);
		}

		for (const customId of [
			'GlobalRefreshInactive',
			'GlobalRefreshActive',
		]) {
			mockHandlers.handleGlobalRefreshInactive.mockClear();
			const interaction = makeButtonInteraction({ customId });

			await handleButtonInteraction(interaction);

			expect(
				mockHandlers.handleGlobalRefreshInactive,
			).toHaveBeenCalledWith(interaction, undefined);
		}
	});
});
