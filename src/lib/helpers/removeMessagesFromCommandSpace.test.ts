import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Collection, TextChannel } from 'discord.js';
import { removeNoncommandMessagesFromPublicCommandSpace } from './removeMessagesFromCommandSpace';
import { client } from '../../test/mocks/discordClient';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeMessage(id: string, ageMs: number) {
	return {
		id,
		createdTimestamp: Date.now() - ageMs,
		delete: vi.fn(async () => undefined),
	};
}

type MessageStub = ReturnType<typeof makeMessage>;

//	the module narrows with `instanceof TextChannel`, and building a real channel
//	needs a live gateway payload, so the stub borrows the prototype instead
function makeCommandChannelStub(newestFirst: MessageStub[]) {
	const fetched = new Collection<string, MessageStub>();
	for (const message of newestFirst) fetched.set(message.id, message);

	const channel = {
		id: 'command-channel',
		bulkDelete: vi.fn(async () => new Collection()),
		messages: { fetch: vi.fn(async () => fetched) },
	};

	return Object.setPrototypeOf(
		channel,
		TextChannel.prototype,
	) as typeof channel;
}

function bulkDeletedIds(channel: ReturnType<typeof makeCommandChannelStub>) {
	const [batch] = channel.bulkDelete.mock.calls[0] as unknown as [
		Collection<string, MessageStub>,
	];
	return [...batch.keys()];
}

describe('removeNoncommandMessagesFromPublicCommandSpace', () => {
	beforeEach(() => {
		process.env.COMMAND_CHANNEL = 'command-channel';
	});

	afterEach(() => {
		delete process.env.COMMAND_CHANNEL;
	});

	it('clears the channel in a single request and keeps the oldest message', async () => {
		// 	fetch returns newest first, so the last entry is the pinned instructions
		const [newest, middle, instructions] = [
			makeMessage('newest', 1000),
			makeMessage('middle', 2000),
			makeMessage('instructions', 3000),
		];
		const channel = makeCommandChannelStub([newest, middle, instructions]);
		vi.mocked(client.channels.fetch).mockResolvedValue(channel as never);

		await removeNoncommandMessagesFromPublicCommandSpace();

		expect(channel.bulkDelete).toHaveBeenCalledTimes(1);
		expect(bulkDeletedIds(channel)).toEqual(['newest', 'middle']);
		for (const message of [newest, middle, instructions]) {
			expect(message.delete).not.toHaveBeenCalled();
		}
	});

	it('falls back to individual deletes only for messages the bulk endpoint rejects', async () => {
		const recent = makeMessage('recent', DAY_MS);
		const stale = makeMessage('stale', 20 * DAY_MS);
		const instructions = makeMessage('instructions', 30 * DAY_MS);
		const channel = makeCommandChannelStub([recent, stale, instructions]);
		vi.mocked(client.channels.fetch).mockResolvedValue(channel as never);

		await removeNoncommandMessagesFromPublicCommandSpace();

		expect(bulkDeletedIds(channel)).toEqual(['recent']);
		expect(stale.delete).toHaveBeenCalledTimes(1);
		expect(recent.delete).not.toHaveBeenCalled();
		expect(instructions.delete).not.toHaveBeenCalled();
	});

	it('reports a missing channel id without throwing', async () => {
		delete process.env.COMMAND_CHANNEL;
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);

		await expect(
			removeNoncommandMessagesFromPublicCommandSpace(),
		).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalled();
	});
});
