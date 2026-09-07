import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../streams/streamAuction', () => ({
	streamAuctionToAllStreamChannels: vi.fn(async () => undefined),
}));
vi.mock('../helpers/env', () => ({
	getEnvironmentVariable: (n: string) => process.env[n] ?? '',
}));
vi.mock('../watchNotification/watchNotification', () => ({
	triggerFoundWatchedItems: vi.fn(async () => undefined),
}));
vi.mock('../playerLink/playerLink', () => ({
	handleLinkMatch: vi.fn(async () => undefined),
}));

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Server } from '../../prisma/client';
import { handleLogLine, generateAuctionKey, parseLogLine } from './monitorLogs';
import { state } from './state';
import { initializeGroupedWatches } from '../../prisma/dbExecutors/watch';
import { streamAuctionToAllStreamChannels } from '../streams/streamAuction';
import { triggerFoundWatchedItems } from '../watchNotification/watchNotification';
import { handleLinkMatch } from '../playerLink/playerLink';
import { redis } from '../../test/mocks/redis';

const LINK_CODE = '12345678-1234-1234-1234-123456789012';

function p99LoggerRecord(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		timestamp: '2026-09-05T12:34:56.789Z',
		server: 'Project 1999: Blue (Velious, PvE)',
		character: 'ExampleCharacter',
		zone: 'ecommons',
		session_id: 'example-session',
		message_id: 1,
		type: 'chat',
		opcode: 4100,
		channel: 4,
		channel_name: 'auction',
		sender: 'Soandso',
		target: '',
		text: 'WTS FBSS 100pp',
		...overrides,
	});
}

describe('handleLogLine', () => {
	beforeEach(() => {
		state.watchedItems = initializeGroupedWatches();
	});

	afterEach(() => {
		vi.mocked(streamAuctionToAllStreamChannels).mockClear();
		vi.mocked(triggerFoundWatchedItems).mockClear();
		vi.mocked(handleLinkMatch).mockClear();
	});

	it('does nothing for lines matching neither auction nor OOC link regex', async () => {
		await handleLogLine(Server.BLUE, 'Soandso says, hello world');

		expect(redis.get).not.toHaveBeenCalled();
		expect(redis.set).not.toHaveBeenCalled();
		expect(streamAuctionToAllStreamChannels).not.toHaveBeenCalled();
		expect(triggerFoundWatchedItems).not.toHaveBeenCalled();
		expect(handleLinkMatch).not.toHaveBeenCalled();
	});

	it('parses auction lines and dispatches streaming and watch handling', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [1],
		};

		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 100pp'");

		expect(streamAuctionToAllStreamChannels).toHaveBeenCalledWith(
			'Soandso',
			Server.BLUE,
			'WTS FBSS 100pp',
			expect.objectContaining({
				selling: expect.arrayContaining([
					expect.objectContaining({ item: 'FBSS', price: 100 }),
				]),
			}),
		);
		expect(triggerFoundWatchedItems).toHaveBeenCalled();
	});

	it('parses p99-logger-client JSONL auction records', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [1],
		};

		await handleLogLine(
			Server.BLUE,
			p99LoggerRecord({
				text: 'WTS FBSS 100pp',
				item_links: [
					{
						body: '00002A0000000000000000000000000000000ABCDEF12',
						text: 'FBSS',
						start: 4,
						end: 55,
						item_id: 42,
					},
				],
			}),
		);

		expect(streamAuctionToAllStreamChannels).toHaveBeenCalledWith(
			'Soandso',
			Server.BLUE,
			'WTS FBSS 100pp',
			expect.objectContaining({
				selling: expect.arrayContaining([
					expect.objectContaining({ item: 'FBSS', price: 100 }),
				]),
			}),
		);
		expect(triggerFoundWatchedItems).toHaveBeenCalled();
	});

	it('routes OOC link lines to handleLinkMatch and not auction handling', async () => {
		const line = `Soandso says out of character, 'Link me: ${LINK_CODE}'`;

		await handleLogLine(Server.BLUE, line);

		expect(handleLinkMatch).toHaveBeenCalledWith(
			'Soandso',
			Server.BLUE,
			LINK_CODE,
		);
		expect(streamAuctionToAllStreamChannels).not.toHaveBeenCalled();
		expect(redis.get).not.toHaveBeenCalled();
	});

	it('routes p99-logger-client JSONL OOC links', async () => {
		await handleLogLine(
			Server.BLUE,
			p99LoggerRecord({
				channel: 5,
				channel_name: 'ooc',
				text: `Link me: ${LINK_CODE}`,
			}),
		);

		expect(handleLinkMatch).toHaveBeenCalledWith(
			'Soandso',
			Server.BLUE,
			LINK_CODE,
		);
		expect(streamAuctionToAllStreamChannels).not.toHaveBeenCalled();
	});

	it('ignores malformed and unrelated JSONL records', async () => {
		expect(parseLogLine('{bad json')).toBeUndefined();
		expect(
			parseLogLine(
				p99LoggerRecord({ channel: 0, channel_name: 'guild' }),
			),
		).toBeUndefined();
		expect(
			parseLogLine(p99LoggerRecord({ type: 'decode_error' })),
		).toBeUndefined();

		await handleLogLine(Server.BLUE, '{bad json');
		expect(streamAuctionToAllStreamChannels).not.toHaveBeenCalled();
		expect(handleLinkMatch).not.toHaveBeenCalled();
	});

	it('does not throw on a malformed partial auction line', async () => {
		await expect(
			handleLogLine(Server.BLUE, "Soandso auctions, 'WTS unclosed"),
		).resolves.toBeUndefined();
		expect(streamAuctionToAllStreamChannels).not.toHaveBeenCalled();
	});

	it('writes parsed auction data to redis with a TTL on cache miss', async () => {
		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 100pp'");

		const cacheSetCall = vi
			.mocked(redis.set)
			.mock.calls.find(([key]) => String(key).startsWith('auctionLog:'));

		expect(cacheSetCall).toBeDefined();
		expect(cacheSetCall?.[2]).toBe('EX');
		expect(cacheSetCall?.[3]).toBe(60 * 60 * 24);
	});

	it('uses cache on second identical auction and skips a second redis set', async () => {
		const line = "Soandso auctions, 'WTS FBSS 100pp'";

		await handleLogLine(Server.BLUE, line);
		const setCallsAfterFirst = vi.mocked(redis.set).mock.calls.length;

		await handleLogLine(Server.BLUE, line);
		const auctionSetCalls = vi
			.mocked(redis.set)
			.mock.calls.filter(([key]) =>
				String(key).startsWith('auctionLog:'),
			);

		expect(auctionSetCalls).toHaveLength(setCallsAfterFirst);
		expect(streamAuctionToAllStreamChannels).toHaveBeenCalledTimes(2);
	});

	it('processes two different auctions from the same player separately', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [1],
			'SICKLY GLOWING ORB': [2],
		};

		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 100pp'");
		await handleLogLine(
			Server.BLUE,
			"Soandso auctions, 'WTS SICKLY GLOWING ORB 50pp'",
		);

		const keys = vi
			.mocked(redis.set)
			.mock.calls.filter(([key]) => String(key).startsWith('auctionLog:'))
			.map(([key]) => key);

		expect(new Set(keys).size).toBe(2);
		expect(triggerFoundWatchedItems).toHaveBeenCalledTimes(2);
	});

	it('dispatches known items through the known-watch path', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [42],
		};

		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 500pp'");

		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[42],
			'Soandso',
			500,
			'WTS FBSS 500pp',
		);
	});

	it('dispatches unknown items through the unknown-watch path with no price', async () => {
		state.watchedItems.BLUE.WTS.unknownItems = [
			{ item: 'CUSTOM SWORD', watchIds: [99] },
		];

		await handleLogLine(
			Server.BLUE,
			"Soandso auctions, 'WTS CUSTOM SWORD 500pp'",
		);

		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[99],
			'Soandso',
			undefined,
			'WTS CUSTOM SWORD 500pp',
		);
	});

	it('dispatches both buying and selling items from one line', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [1],
		};
		state.watchedItems.BLUE.WTB.knownItems = {
			'FLAWLESS DIAMOND': [2],
		};

		await handleLogLine(
			Server.BLUE,
			"Soandso auctions, 'WTS FBSS 100pp WTB FLAWLESS DIAMOND 50pp'",
		);

		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[1],
			'Soandso',
			100,
			'WTS FBSS 100pp WTB FLAWLESS DIAMOND 50pp',
		);
		expect(triggerFoundWatchedItems).toHaveBeenCalledWith(
			[2],
			'Soandso',
			50,
			'WTS FBSS 100pp WTB FLAWLESS DIAMOND 50pp',
		);
	});

	it('handles auction text containing regex metacharacters without throwing', async () => {
		state.watchedItems.BLUE.WTS.knownItems = {
			'FLOWING BLACK SILK SASH': [1],
		};

		await expect(
			handleLogLine(
				Server.BLUE,
				"Soandso auctions, 'WTS FBSS (100pp) [special]'",
			),
		).resolves.toBeUndefined();

		expect(streamAuctionToAllStreamChannels).toHaveBeenCalled();
	});

	it('invokes streamAuction even when no watch matched', async () => {
		await handleLogLine(Server.BLUE, "Soandso auctions, 'WTS FBSS 100pp'");

		expect(streamAuctionToAllStreamChannels).toHaveBeenCalledTimes(1);
		expect(triggerFoundWatchedItems).not.toHaveBeenCalled();
	});
});

describe('generateAuctionKey', () => {
	it('keys dedupe by auction message text, not player name', () => {
		const keyA = generateAuctionKey('WTS FBSS 100PP');
		const keyB = generateAuctionKey('WTS PF 50PP');

		expect(keyA).toMatch(/^auctionLog:/);
		expect(keyA).not.toBe(keyB);
		expect(generateAuctionKey('WTS FBSS 100PP')).toBe(keyA);
	});
});
