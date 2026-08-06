import { vi } from 'vitest';
import {
	BlockedPlayer,
	BlockedPlayerByWatch,
	PlayerLink,
	Server,
	User,
	Watch,
	WatchType,
} from '../prisma/client';
import {
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
} from 'discord.js';

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
		blockedWatches: [] as BlockedPlayerByWatch[],
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

export function makePlayerLink(
	overrides: Partial<PlayerLink> = {},
): PlayerLink {
	return {
		id: 1,
		discordUserId: '100',
		server: Server.BLUE,
		player: 'Soandso',
		linkCode: null,
		linkCodeExpiry: null,
		...overrides,
	};
}

export function makeBlockedPlayerByWatch(
	overrides: Partial<BlockedPlayerByWatch> = {},
): BlockedPlayerByWatch {
	return {
		id: 1,
		discordUserId: '100',
		watchId: 1,
		player: 'SOANDSO',
		...overrides,
	};
}

export function makeWatchNotificationMetadata(
	overrides: Record<string, unknown> = {},
) {
	return {
		...makeWatchWithUser(),
		player: 'Soandso',
		price: 100,
		auctionMessage: 'WTS FLOWING BLACK SILK SASH 100pp',
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
		deferReply: vi.fn(async () => ({})),
		editReply: vi.fn(async () => ({})),
		followUp: vi.fn(async () => ({})),
		deleteReply: vi.fn(async () => ({})),
		respond: vi.fn(async () => ({})),
		inGuild: vi.fn(() => true),
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

export function makeAutocompleteInteraction(
	overrides: Record<string, unknown> = {},
): AutocompleteInteraction {
	const base = {
		user: { id: '100', username: 'tester' },
		options: {
			getFocused: vi.fn(() => ''),
		},
		respond: vi.fn(async () => ({})),
		isAutocomplete: () => true,
		...overrides,
	};
	return base as unknown as AutocompleteInteraction;
}

export function makeButtonInteraction(
	overrides: Record<string, unknown> = {},
): ButtonInteraction {
	const base = {
		customId: 'WatchSnoozeInactive:1',
		user: { id: '100', username: 'tester' },
		update: vi.fn(async () => ({})),
		reply: vi.fn(async () => ({})),
		message: { embeds: [] },
		isButton: () => true,
		id: 'interaction-1',
		...overrides,
	};
	return base as unknown as ButtonInteraction;
}
