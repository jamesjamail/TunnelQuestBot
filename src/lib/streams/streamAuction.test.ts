import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));
vi.mock('../content/messages/messageBuilder', () => ({
	embeddedAuctionStreamMessageBuilder: vi.fn(async () => []),
	packEmbedsForDiscord: vi.fn((embeds: unknown[]) => [embeds]),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelType } from 'discord.js';
import { Server } from '../../prisma/client';
import { streamAuctionToAllStreamChannels } from './streamAuction';
import { gracefullyHandleError } from '../helpers/errors';
import {
	embeddedAuctionStreamMessageBuilder,
	packEmbedsForDiscord,
} from '../content/messages/messageBuilder';
import {
	client,
	makeTextChannelStub,
	resetChannelCache,
} from '../../test/mocks/discordClient';

function getChannelSend(channelId: string) {
	const channel = client.channels.cache.get(channelId) as ReturnType<
		typeof makeTextChannelStub
	>;
	return channel.send;
}

describe('streamAuctionToAllStreamChannels', () => {
	beforeEach(() => {
		resetChannelCache();
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue([]);
		vi.mocked(packEmbedsForDiscord).mockImplementation((embeds) => [
			embeds,
		]);
	});

	it('sends plain text to classic and embeds to embedded for one auction', async () => {
		const embeds = [{ data: { title: 'WTS' } }];
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue(
			embeds as never,
		);

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS FBSS 100pp',
			{ buying: [], selling: [{ item: 'FBSS', price: 100 }] },
		);

		expect(getChannelSend('BLUE-embedded')).toHaveBeenCalledWith({
			embeds,
			allowedMentions: { users: [] },
		});
		expect(getChannelSend('BLUE-classic')).toHaveBeenCalledWith(
			"```\nSoandso auctions, 'WTS FBSS 100pp'```",
		);
	});

	it('still sends to classic when embedded send throws', async () => {
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue([
			{ data: { title: 'WTS' } },
		] as never);
		getChannelSend('BLUE-embedded').mockRejectedValueOnce(
			new Error('embedded down'),
		);

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS FBSS',
			{ buying: [], selling: [] },
		);

		expect(gracefullyHandleError).toHaveBeenCalled();
		expect(getChannelSend('BLUE-classic')).toHaveBeenCalled();
	});

	it('still sends to embedded when classic send throws', async () => {
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue([
			{ data: { title: 'WTS' } },
		] as never);
		getChannelSend('BLUE-classic').mockRejectedValueOnce(
			new Error('classic down'),
		);

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS FBSS',
			{ buying: [], selling: [] },
		);

		expect(gracefullyHandleError).toHaveBeenCalled();
		expect(getChannelSend('BLUE-embedded')).toHaveBeenCalled();
	});

	it('reports embedded channel failures with the embedded channel id', async () => {
		client.channels.cache.delete('BLUE-embedded');

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS FBSS',
			{ buying: [], selling: [] },
		);

		const firstError = vi.mocked(gracefullyHandleError).mock.calls[0]?.[0];
		expect(firstError).toBeInstanceOf(Error);
		expect((firstError as Error).message).toContain('BLUE-embedded');
		expect((firstError as Error).message.toLowerCase()).toContain(
			'embedded',
		);
	});

	it('handles a missing channel in the cache without throwing', async () => {
		client.channels.cache.delete('GREEN-classic');

		await expect(
			streamAuctionToAllStreamChannels(
				'Soandso',
				Server.GREEN,
				'WTS FBSS',
				{ buying: [], selling: [] },
			),
		).resolves.toBeUndefined();

		expect(gracefullyHandleError).toHaveBeenCalled();
	});

	it('resolves each server to its own classic and embedded channels', async () => {
		for (const server of [Server.BLUE, Server.GREEN, Server.RED]) {
			vi.mocked(
				embeddedAuctionStreamMessageBuilder,
			).mockResolvedValueOnce([{ data: { title: server } }] as never);

			await streamAuctionToAllStreamChannels(
				'Soandso',
				server,
				'WTS ITEM',
				{ buying: [], selling: [] },
			);

			expect(getChannelSend(`${server}-embedded`)).toHaveBeenCalled();
			expect(getChannelSend(`${server}-classic`)).toHaveBeenCalled();
		}
	});

	it('sends at most 10 embeds to the embedded channel', async () => {
		const embeds = Array.from({ length: 10 }, (_, index) => ({
			data: { title: `embed-${index}` },
		}));
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue(
			embeds as never,
		);

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS MANY ITEMS',
			{
				buying: [],
				selling: Array.from({ length: 300 }, (_, index) => ({
					item: `ITEM ${index}`,
					price: 1,
				})),
			},
		);

		const sendArg = vi.mocked(getChannelSend('BLUE-embedded')).mock
			.calls[0]?.[0] as { embeds: unknown[] };
		expect(sendArg.embeds.length).toBeLessThanOrEqual(10);
	});

	it('sends aggregate-limit batches as separate messages', async () => {
		const first = { data: { title: 'first' } };
		const second = { data: { title: 'second' } };
		vi.mocked(embeddedAuctionStreamMessageBuilder).mockResolvedValue([
			first,
			second,
		] as never);
		vi.mocked(packEmbedsForDiscord).mockReturnValue([
			[first],
			[second],
		] as never);

		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS MANY ITEMS',
			{ buying: [], selling: [] },
		);

		expect(getChannelSend('BLUE-embedded')).toHaveBeenCalledTimes(2);
		expect(getChannelSend('BLUE-embedded')).toHaveBeenNthCalledWith(1, {
			embeds: [first],
			allowedMentions: { users: [] },
		});
		expect(getChannelSend('BLUE-embedded')).toHaveBeenNthCalledWith(2, {
			embeds: [second],
			allowedMentions: { users: [] },
		});
	});

	it('throws from getEnvironmentVariable when server stream env is missing', async () => {
		const original = process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;

		await expect(
			streamAuctionToAllStreamChannels(
				'Soandso',
				Server.RED,
				'WTS FBSS',
				{ buying: [], selling: [] },
			),
		).rejects.toThrow(
			'Environment variable SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID is not defined.',
		);

		process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID = original;
	});

	it('reports non-text cached channels as fetch failures without throwing', async () => {
		client.channels.cache.set('BLUE-embedded', {
			id: 'BLUE-embedded',
			type: ChannelType.GuildVoice,
			isTextBased: () => false,
		});

		await expect(
			streamAuctionToAllStreamChannels(
				'Soandso',
				Server.BLUE,
				'WTS FBSS',
				{ buying: [], selling: [] },
			),
		).resolves.toBeUndefined();

		expect(gracefullyHandleError).toHaveBeenCalled();
		resetChannelCache();
	});
});
