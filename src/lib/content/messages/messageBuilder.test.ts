import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../helpers/fetchHistoricalPricing', () => ({
	fetchHistoricalPricingForItem: vi.fn(async () => null),
	fetchHistoricalPricingForItems: vi.fn(async () => ({})),
}));
vi.mock('../../../prisma/dbExecutors/playerLink', () => ({
	getPlayerLink: vi.fn(async () => null),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbedBuilder } from 'discord.js';
import { Server, WatchType } from '../../../prisma/client';
import {
	blockCommandResponseBuilder,
	embeddedAuctionStreamMessageBuilder,
	formatHoverText,
	formatserverEnumToReadableString,
	HistoricalData,
	listCommandResponseBuilder,
	playerlinkCommandResponseBuilder,
	watchCommandResponseBuilder,
	watchNotificationBuilder,
} from './messageBuilder';
import {
	fetchHistoricalPricingForItem,
	fetchHistoricalPricingForItems,
} from '../../helpers/fetchHistoricalPricing';
import { getPlayerLink } from '../../../prisma/dbExecutors/playerLink';
import { gracefullyHandleError } from '../../helpers/errors';
import {
	makeBlockedPlayer,
	makePlayerLink,
	makeUser,
	makeWatch,
	makeWatchWithUser,
} from '../../../test/factories';

const KNOWN_ITEM = 'FLOWING BLACK SILK SASH';
const UNKNOWN_ITEM = 'SOME MADE UP THING';

function assertEmbedWithinDiscordLimits(embed: EmbedBuilder) {
	const json = embed.toJSON();
	expect(json.fields?.length ?? 0).toBeLessThanOrEqual(25);
	expect(json.description?.length ?? 0).toBeLessThanOrEqual(4096);
	expect(json.title?.length ?? 0).toBeLessThanOrEqual(256);
	expect(json.author?.name?.length ?? 0).toBeLessThanOrEqual(256);
	expect(json.footer?.text?.length ?? 0).toBeLessThanOrEqual(2048);
	for (const field of json.fields ?? []) {
		expect(field.name.length).toBeLessThanOrEqual(256);
		expect(field.value.length).toBeLessThanOrEqual(1024);
	}
	const total =
		(json.title?.length ?? 0) +
		(json.description?.length ?? 0) +
		(json.author?.name?.length ?? 0) +
		(json.footer?.text?.length ?? 0) +
		(json.fields ?? []).reduce(
			(n, f) => n + f.name.length + f.value.length,
			0,
		);
	expect(total).toBeLessThanOrEqual(6000);
}

function makeHistoricalData(
	overrides: Partial<HistoricalData> = {},
): HistoricalData {
	return {
		eQitemId: 1,
		itemName: 'ITEM 0',
		server: 0,
		lastWTBSeen: null,
		lastWTSSeen: null,
		totalWTSAuctionCount: 0,
		totalWTSAuctionAverage: 0,
		totalWTSLast30DaysCount: 12,
		totalWTSLast30DaysAverage: 100,
		totalWTSLast60DaysCount: 0,
		totalWTSLast60DaysAverage: 0,
		totalWTSLast90DaysCount: 0,
		totalWTSLast90DaysAverage: 0,
		totalWTSLast6MonthsCount: 0,
		totalWTSLast6MonthsAverage: 0,
		totalWTSLastYearCount: 0,
		totalWTSLastYearAverage: 0,
		totalWTBAuctionCount: 0,
		totalWTBAuctionAverage: 0,
		totalWTBLast30DaysCount: 0,
		totalWTBLast30DaysAverage: 0,
		totalWTBLast60DaysCount: 0,
		totalWTBLast60DaysAverage: 0,
		totalWTBLast90DaysCount: 0,
		totalWTBLast90DaysAverage: 0,
		totalWTBLast6MonthsCount: 0,
		totalWTBLast6MonthsAverage: 0,
		totalWTBLastYearCount: 0,
		totalWTBLastYearAverage: 0,
		...overrides,
	};
}

function fieldValueContaining(embed: EmbedBuilder, text: string): string {
	const fields = embed.toJSON().fields ?? [];
	const match = fields.find((field) => field.value.includes(text));
	return match?.value ?? '';
}

describe('watchCommandResponseBuilder', () => {
	it('uses WTS less-than-or-equal copy for a known item with a price', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({
				watchType: WatchType.WTS,
				itemName: KNOWN_ITEM,
				priceRequirement: 500,
			}),
		);
		expect(fieldValueContaining(embed, 'less than or equal to')).toContain(
			'500pp',
		);
	});

	it('uses WTB equal-to-or-greater copy for a known item with a price', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({
				watchType: WatchType.WTB,
				itemName: KNOWN_ITEM,
				priceRequirement: 500,
			}),
		);
		expect(
			fieldValueContaining(embed, 'equal to or greater than'),
		).toContain('500pp');
	});

	it('warns about unreliable parsing for an unknown item with a price', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({
				itemName: UNKNOWN_ITEM,
				priceRequirement: 500,
			}),
		);
		expect(
			fieldValueContaining(embed, 'unreliable price parsing'),
		).toBeTruthy();
	});

	it('omits price-specific copy when there is no price requirement', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ itemName: KNOWN_ITEM, priceRequirement: null }),
		);
		const value = fieldValueContaining(embed, 'This watch will trigger');
		expect(value).not.toContain('less than or equal to');
		expect(value).not.toContain('equal to or greater than');
		expect(value).not.toContain('unreliable price parsing');
	});

	it('adds a snooze field when the watch is snoozed', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({
				snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
			}),
		);
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names.some((name) => name.includes('💤'))).toBe(true);
	});

	it('does not add a snooze field when the watch is not snoozed', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ snoozedUntil: null }),
		);
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names.some((name) => name.includes('💤'))).toBe(false);
	});

	it('adds a notes field when notes are present', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ notes: 'watch these closely' }),
		);
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names).toContain('Notes:');
	});

	it('does not add a notes field when notes are absent', () => {
		const embed = watchCommandResponseBuilder(makeWatch({ notes: null }));
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names).not.toContain('Notes:');
	});

	it('sets author URL and thumbnail for a known item', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ itemName: KNOWN_ITEM }),
		);
		const json = embed.toJSON();
		expect(json.author?.url).toBeTruthy();
		expect(json.author?.icon_url).toBeTruthy();
	});

	it('leaves author URL and thumbnail unset for an unknown item', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ itemName: UNKNOWN_ITEM }),
		);
		const json = embed.toJSON();
		expect(json.author?.url).toBeUndefined();
		expect(json.author?.icon_url).toBeUndefined();
	});

	it('sets the title to the watch type plus Auction Watch', () => {
		expect(
			watchCommandResponseBuilder(
				makeWatch({ watchType: WatchType.WTS }),
			).toJSON().title,
		).toBe('WTS Auction Watch');
		expect(
			watchCommandResponseBuilder(
				makeWatch({ watchType: WatchType.WTB }),
			).toJSON().title,
		).toBe('WTB Auction Watch');
	});

	it('stays within Discord limits under hostile input', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({
				itemName: 'x'.repeat(255),
				notes: 'n'.repeat(5000),
				priceRequirement: 999999,
			}),
		);
		assertEmbedWithinDiscordLimits(embed);
	});
});

describe('watchNotificationBuilder', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItem).mockResolvedValue(null);
		vi.mocked(getPlayerLink).mockResolvedValue(null);
	});

	it('describes a WTS watch as selling with player, item, and server', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({
				watchType: WatchType.WTS,
				itemName: KNOWN_ITEM,
				server: Server.BLUE,
			}),
			'Soandso',
			undefined,
			'auction line',
		);
		const description = embed.toJSON().description ?? '';
		expect(description).toContain('**Soandso**');
		expect(description).toContain('selling');
		expect(description).toContain('Flowing Black Silk Sash');
		expect(description).toContain('Blue Server');
	});

	it('describes a WTB watch as buying', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({ watchType: WatchType.WTB }),
			'Soandso',
			undefined,
			'auction line',
		);
		expect(embed.toJSON().description ?? '').toContain('buying');
	});

	it('includes formatted price when a price is provided', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			1500,
			'auction line',
		);
		expect(embed.toJSON().description ?? '').toContain('for **1.5k**');
	});

	it('omits the price clause when no price is provided', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			undefined,
			'auction line',
		);
		const description = embed.toJSON().description ?? '';
		expect(description).not.toMatch(/for \*\*/);
	});

	it('logs and falls back to unknown item when itemName is empty', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({ itemName: '   ' }),
			'Soandso',
			undefined,
			'auction line',
		);
		expect(gracefullyHandleError).toHaveBeenCalled();
		expect(embed.toJSON().author?.name).toBe('unknown item');
		expect(embed.toJSON().description ?? '').toContain('Unknown Item');
	});

	it('adds historical pricing fields when data is present', async () => {
		vi.mocked(fetchHistoricalPricingForItem).mockResolvedValue(
			makeHistoricalData(),
		);
		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			100,
			'auction line',
		);
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names).toContain('Historical Pricing (WTS)');
		expect(names).toContain('Historical Pricing (WTB)');
	});

	it('adds no historical pricing fields when data is null', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			100,
			'auction line',
		);
		const names = (embed.toJSON().fields ?? []).map((field) => field.name);
		expect(names).not.toContain('Historical Pricing (WTS)');
		expect(names).not.toContain('Historical Pricing (WTB)');
	});

	it('formats the player link mention without a stray slash', async () => {
		vi.mocked(getPlayerLink).mockResolvedValue({
			id: 1,
			discordUserId: '42',
			server: Server.BLUE,
			player: 'Soandso',
			linkCode: null,
			linkCodeExpiry: null,
		});

		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			undefined,
			'msg',
		);

		const description = embed.toJSON().description ?? '';
		expect(description).toContain('**Soandso** (<@42>)');
		expect(description).not.toContain('/<@42>');
	});

	it('keeps the title within 256 characters for a 255-character item name', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({ itemName: 'x'.repeat(255) }),
			'Soandso',
			undefined,
			'auction line',
		);
		expect((embed.toJSON().title ?? '').length).toBeLessThanOrEqual(256);
	});

	it('truncates description when auctionMessage exceeds 4096 characters', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser(),
			'Soandso',
			100,
			'm'.repeat(5000),
		);
		expect((embed.toJSON().description ?? '').length).toBeLessThanOrEqual(
			4096,
		);
	});

	it('stays within Discord limits under hostile input', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({
				itemName: 'x'.repeat(255),
				notes: 'n'.repeat(5000),
			}),
			'Soandso',
			999999,
			'a'.repeat(5000),
		);
		assertEmbedWithinDiscordLimits(embed);
	});
});

describe('listCommandResponseBuilder', () => {
	it('groups watches by server with one field per watch', () => {
		const embeds = listCommandResponseBuilder(
			[
				makeWatch({ id: 1, server: Server.BLUE, itemName: 'BLUE ONE' }),
				makeWatch({
					id: 2,
					server: Server.GREEN,
					itemName: 'GREEN ONE',
				}),
			],
			makeUser(),
		);
		const authors = embeds.map((embed) => embed.toJSON().author?.name);
		expect(authors).toContain('Project 1999 Blue Server');
		expect(authors).toContain('Project 1999 Green Server');
		expect(
			embeds.reduce((n, e) => n + (e.toJSON().fields ?? []).length, 0),
		).toBe(2);
	});

	it('does not produce embeds with empty fields and respects the 25-field limit', () => {
		const blueWatches = Array.from({ length: 30 }, (_, i) =>
			makeWatch({
				id: i + 1,
				server: Server.BLUE,
				itemName: `BLUE ITEM ${i}`,
			}),
		);
		const greenWatches = Array.from({ length: 5 }, (_, i) =>
			makeWatch({
				id: 100 + i,
				server: Server.GREEN,
				itemName: `GREEN ITEM ${i}`,
			}),
		);

		const embeds = listCommandResponseBuilder(
			[...blueWatches, ...greenWatches],
			makeUser(),
		);

		for (const embed of embeds) {
			const fields = embed.toJSON().fields ?? [];
			expect(fields.length).toBeGreaterThan(0);
			expect(fields.length).toBeLessThanOrEqual(25);
		}
	});

	it('prepends a global snooze embed when the user is snoozed', () => {
		const embeds = listCommandResponseBuilder(
			[makeWatch()],
			makeUser({ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) }),
		);
		expect((embeds[0].toJSON().fields ?? [])[0]?.value).toContain(
			'Global snooze is active',
		);
	});

	it('does not prepend a global snooze embed when the user is not snoozed', () => {
		const embeds = listCommandResponseBuilder([makeWatch()], makeUser());
		expect((embeds[0].toJSON().fields ?? [])[0]?.value).not.toContain(
			'Global snooze is active',
		);
	});

	it('caps at 10 embeds with a truncation notice when watches exceed the limit', () => {
		const watches = Array.from({ length: 230 }, (_, i) =>
			makeWatch({
				id: i + 1,
				server: Server.BLUE,
				itemName: `ITEM ${i}`,
			}),
		);
		const embeds = listCommandResponseBuilder(watches, makeUser());
		expect(embeds).toHaveLength(10);
		const lastField = (embeds[9].toJSON().fields ?? [])[0];
		expect(lastField?.value).toContain('Some have been omitted');
	});

	it('does not throw on empty watches', () => {
		expect(() => listCommandResponseBuilder([], makeUser())).not.toThrow();
		expect(listCommandResponseBuilder([], makeUser())).toEqual([]);
	});

	it('stays within Discord limits under hostile input', () => {
		const watches = Array.from({ length: 200 }, (_, i) =>
			makeWatch({
				id: i + 1,
				itemName: `HOSTILE ITEM ${i}`,
				priceRequirement: 999999,
			}),
		);
		const embeds = listCommandResponseBuilder(watches, makeUser());
		for (const embed of embeds) {
			assertEmbedWithinDiscordLimits(embed);
		}
	});
});

describe('embeddedAuctionStreamMessageBuilder', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItems).mockResolvedValue({});
		vi.mocked(getPlayerLink).mockResolvedValue(null);
	});

	it('chunks item fields across embeds when there are more than 25 items', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS lots of stuff',
			{
				selling: Array.from({ length: 30 }, (_, i) => ({
					item: `ITEM ${i}`,
				})),
				buying: [],
			},
		);

		for (const embed of embeds) {
			expect((embed.toJSON().fields ?? []).length).toBeLessThanOrEqual(
				25,
			);
		}
		expect(embeds.length).toBeLessThanOrEqual(10);
		const totalFields = embeds.reduce(
			(sum, embed) => sum + (embed.toJSON().fields ?? []).length,
			0,
		);
		expect(totalFields).toBe(30);
	});

	it('caps at 10 embeds and drops excess items beyond 250', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS lots of stuff',
			{
				selling: Array.from({ length: 260 }, (_, i) => ({
					item: `ITEM ${i}`,
				})),
				buying: [],
			},
		);
		expect(embeds).toHaveLength(10);
		const totalFields = embeds.reduce(
			(sum, embed) => sum + (embed.toJSON().fields ?? []).length,
			0,
		);
		expect(totalFields).toBe(250);
	});

	it('puts author and description only on the first embed and footer only on the last', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS ITEM 0',
			{
				selling: Array.from({ length: 30 }, (_, i) => ({
					item: `ITEM ${i}`,
				})),
				buying: [],
			},
		);
		expect(embeds[0].toJSON().author?.name).toContain('[ WTS ]');
		expect(embeds[0].toJSON().description).toBeTruthy();
		expect(embeds[1].toJSON().author).toBeUndefined();
		expect(embeds[1].toJSON().description).toBeUndefined();
		expect(embeds[0].toJSON().footer).toBeUndefined();
		expect(embeds.at(-1)?.toJSON().footer?.text).toContain('Blue');
	});

	it('returns one embed and infers WTS from raw text when no items parsed', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS nothing parsed here',
			{ selling: [], buying: [] },
		);
		expect(embeds).toHaveLength(1);
		expect(embeds[0].toJSON().author?.name).toContain('[ WTS ]');
	});

	it('infers WTB from raw text when no items parsed', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTB nothing parsed here',
			{ selling: [], buying: [] },
		);
		expect(embeds[0].toJSON().author?.name).toContain('[ WTB ]');
	});

	it('infers WTS/WTB from raw text when both appear and no items parsed', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS foo WTB bar',
			{ selling: [], buying: [] },
		);
		expect(embeds[0].toJSON().author?.name).toContain('[ WTS/WTB ]');
	});

	it('prefixes field names when both buying and selling items are present', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS ITEM A WTB ITEM B',
			{
				selling: [{ item: 'ITEM A', price: 100 }],
				buying: [{ item: 'ITEM B', price: 200 }],
			},
		);
		const names = (embeds[0].toJSON().fields ?? []).map(
			(field) => field.name,
		);
		expect(names.some((name) => name.startsWith('WTS:'))).toBe(true);
		expect(names.some((name) => name.startsWith('WTB:'))).toBe(true);
	});

	it('does not prefix field names when only one type is present', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS ITEM A',
			{
				selling: [{ item: 'ITEM A', price: 100 }],
				buying: [],
			},
		);
		const names = (embeds[0].toJSON().fields ?? []).map(
			(field) => field.name,
		);
		expect(names.every((name) => !name.startsWith('WTS:'))).toBe(true);
		expect(names.every((name) => !name.startsWith('WTB:'))).toBe(true);
	});

	it('assigns the same timestamp and server color to every embed', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.GREEN,
			'WTS lots of stuff',
			{
				selling: Array.from({ length: 30 }, (_, i) => ({
					item: `ITEM ${i}`,
				})),
				buying: [],
			},
		);
		const timestamps = embeds.map((embed) => embed.toJSON().timestamp);
		const colors = embeds.map((embed) => embed.toJSON().color);
		expect(new Set(timestamps).size).toBe(1);
		expect(new Set(colors).size).toBe(1);
	});

	it('truncates description when auctionText exceeds 4096 characters', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			't'.repeat(5000),
			{ selling: [], buying: [] },
		);
		expect(
			(embeds[0].toJSON().description ?? '').length,
		).toBeLessThanOrEqual(4096);
	});

	it('renders a zero average as a price rather than a dash', async () => {
		const historicalData = makeHistoricalData({
			totalWTSLast30DaysAverage: 0,
		});
		vi.mocked(fetchHistoricalPricingForItems).mockResolvedValue({
			'ITEM 0': historicalData,
		});

		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS ITEM 0',
			{ selling: [{ item: 'ITEM 0' }], buying: [] },
		);

		const allValues = embeds.flatMap((embed) =>
			(embed.toJSON().fields ?? []).map((field) => field.value ?? ''),
		);
		expect(allValues.some((value) => value.includes('Avg: -'))).toBe(false);
	});

	it('stays within Discord limits under hostile input', async () => {
		const embeds = await embeddedAuctionStreamMessageBuilder(
			'Soandso',
			Server.BLUE,
			'WTS lots of expensive stuff',
			{
				selling: Array.from({ length: 200 }, (_, i) => ({
					item: `ITEM ${i}`,
					price: 999999,
				})),
				buying: [],
			},
		);
		for (const embed of embeds) {
			assertEmbedWithinDiscordLimits(embed);
		}
	});
});

describe('playerlinkCommandResponseBuilder', () => {
	it('returns an embed when the link has a server', () => {
		const embed = playerlinkCommandResponseBuilder(makePlayerLink());
		expect(embed).toBeInstanceOf(EmbedBuilder);
		expect(embed?.toJSON().title).toBe('Soandso (BLUE)');
	});

	it('returns undefined when the link has no server', () => {
		expect(
			playerlinkCommandResponseBuilder(makePlayerLink({ server: null })),
		).toBeUndefined();
	});

	it('stays within Discord limits under hostile input', () => {
		const embed = playerlinkCommandResponseBuilder(
			makePlayerLink({ player: 'x'.repeat(240) }),
		);
		if (embed) {
			assertEmbedWithinDiscordLimits(embed);
		}
	});
});

describe('blockCommandResponseBuilder', () => {
	it('names the blocked player in the title', () => {
		const embed = blockCommandResponseBuilder(
			makeBlockedPlayer({ player: 'BLOCKEDGUY', server: Server.RED }),
		);
		expect(embed.toJSON().title).toBe('--- BLOCKEDGUY ---');
		expect(embed.toJSON().author?.name).toBe('Player Block');
	});

	it('stays within Discord limits under hostile input', () => {
		assertEmbedWithinDiscordLimits(
			blockCommandResponseBuilder(
				makeBlockedPlayer({ player: 'x'.repeat(240) }),
			),
		);
	});
});

describe('formatHoverText', () => {
	it('produces markdown link syntax with hover text', () => {
		expect(
			formatHoverText('Item', 'https://wiki.example.com/item', 'hover'),
		).toBe('[Item](https://wiki.example.com/item "hover")');
	});

	it('escapes double quotes inside hover text', () => {
		expect(
			formatHoverText(
				'Item',
				'https://wiki.example.com/item',
				'say "hi"',
			),
		).toBe('[Item](https://wiki.example.com/item "say \'hi\'")');
	});

	it('falls back to WIKI_BASE_URL when wikiUrl is empty', () => {
		expect(formatHoverText('Item', '', 'hover')).toBe(
			'[Item](https://wiki.example.com "hover")',
		);
	});

	it('uses the default hover text when none is provided', () => {
		expect(formatHoverText('Item', 'https://wiki.example.com/item')).toBe(
			'[Item](https://wiki.example.com/item " ")',
		);
	});
});

describe('formatserverEnumToReadableString', () => {
	it('formats BLUE as Blue', () => {
		expect(formatserverEnumToReadableString(Server.BLUE)).toBe('Blue');
	});

	it('formats GREEN as Green', () => {
		expect(formatserverEnumToReadableString(Server.GREEN)).toBe('Green');
	});

	it('formats RED as Red', () => {
		expect(formatserverEnumToReadableString(Server.RED)).toBe('Red');
	});
});

describe('notes field length', () => {
	beforeEach(() => {
		vi.mocked(fetchHistoricalPricingForItem).mockResolvedValue(null);
	});

	it('truncates long notes in watchCommandResponseBuilder', () => {
		const embed = watchCommandResponseBuilder(
			makeWatch({ notes: 'x'.repeat(2000) }),
		);
		for (const field of embed.toJSON().fields ?? []) {
			expect(field.value?.length ?? 0).toBeLessThanOrEqual(1024);
		}
	});

	it('truncates long notes in watchNotificationBuilder', async () => {
		const embed = await watchNotificationBuilder(
			makeWatchWithUser({ notes: 'x'.repeat(2000) }),
			'Soandso',
			100,
			'msg',
		);
		for (const field of embed.toJSON().fields ?? []) {
			expect(field.value?.length ?? 0).toBeLessThanOrEqual(1024);
		}
	});
});
