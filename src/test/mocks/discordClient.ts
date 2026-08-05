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

export const client = {
	isReady: vi.fn(() => true),
	login: vi.fn(async () => 'token'),
	users: {
		send: vi.fn(async () => ({})),
		fetch: vi.fn(async () => ({ username: 'testuser' })),
	},
	channels: {
		cache: new Map<string, unknown>(),
		fetch: vi.fn(async () => makeTextChannelStub()),
	},
};
