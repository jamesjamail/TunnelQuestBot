import { vi } from 'vitest';
import { ChannelType } from 'discord.js';

export function makeTextChannelStub(id = 'chan') {
	const thread = { send: vi.fn(async () => ({})) };
	return {
		id,
		type: ChannelType.GuildText,
		isTextBased: () => true,
		send: vi.fn(async () => ({ startThread: vi.fn(async () => thread) })),
	};
}

const STREAM_CHANNEL_IDS = [
	'BLUE-classic',
	'BLUE-embedded',
	'GREEN-classic',
	'GREEN-embedded',
	'RED-classic',
	'RED-embedded',
];

export function resetChannelCache() {
	client.channels.cache.clear();
	for (const id of STREAM_CHANNEL_IDS) {
		client.channels.cache.set(id, makeTextChannelStub(id));
	}
}

export const client = {
	isReady: vi.fn(() => true),
	login: vi.fn(async () => 'token'),
	users: {
		send: vi.fn(async () => ({})),
		fetch: vi.fn(async () => ({ username: 'testuser' })),
		createDM: vi.fn(async () => makeTextChannelStub('dm-1')),
	},
	channels: {
		cache: new Map<string, unknown>(),
		fetch: vi.fn(async () => makeTextChannelStub()),
	},
};

resetChannelCache();
