import { vi } from 'vitest';
import { BlockedPlayer, Server, User, Watch, WatchType } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';

export function makeUser(overrides: Partial<User> = {}): User {
	return {
		discordUserId: '100',
		createdAt: new Date(),
		updatedAt: new Date(),
		discordUsername: 'tester',
		snoozedUntil: null,
		...overrides,
	};
}

export function makeWatch(overrides: Partial<Watch> = {}): Watch {
	return {
		id: 1,
		discordUserId: '100',
		server: Server.BLUE,
		watchType: WatchType.WTS,
		itemName: 'FLOWING BLACK SILK SASH',
		priceRequirement: null,
		created: new Date(),
		active: true,
		snoozedUntil: null,
		notes: null,
		isPublicallyTradeable: true,
		...overrides,
	};
}

export function makeWatchWithUser(
	overrides: Partial<Watch> = {},
	userOverrides: Partial<User> = {},
) {
	return {
		...makeWatch(overrides),
		user: makeUser(userOverrides),
		blockedWatches: [],
	};
}

export function makeBlockedPlayer(
	overrides: Partial<BlockedPlayer> = {},
): BlockedPlayer {
	return {
		id: 1,
		discordUserId: '100',
		server: Server.BLUE,
		player: 'SOANDSO',
		active: true,
		...overrides,
	};
}

export function makeChatInteraction(
	overrides: Record<string, unknown> = {},
): ChatInputCommandInteraction {
	const base = {
		user: { id: '100', username: 'tester' },
		options: {
			get: vi.fn(),
			getFocused: vi.fn(),
		},
		reply: vi.fn(async () => ({})),
		deleteReply: vi.fn(async () => ({})),
		respond: vi.fn(async () => ({})),
		isChatInputCommand: () => true,
		isButton: () => false,
		isAutocomplete: () => false,
		client: {
			slashCommands: new Map(),
			cooldowns: new Map(),
		},
		channelId: 'chan-1',
		id: 'interaction-1',
		commandName: 'watch',
		...overrides,
	};
	return base as unknown as ChatInputCommandInteraction;
}
