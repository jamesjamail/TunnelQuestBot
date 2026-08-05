import {
	Watch,
	Server,
	User,
	BlockedPlayer,
	PlayerLink,
	WatchType,
} from '@prisma/client';
import { APIEmbedField, EmbedAuthorOptions, EmbedBuilder } from 'discord.js';
import {
	formatSnoozeExpirationTimestamp,
	formatWatchExpirationTimestamp,
} from '../../helpers/datetime';
import { getServerColorFromString } from '../../helpers/colors';
import { EmbedField } from 'discord.js';
import {
	formatPriceNumberToReadableString,
	isSnoozed,
} from '../../helpers/watches';
import {
	AuctionData,
	ItemType,
	getEnvironmentVariable,
} from '../../streams/streamAuction';
import { getImageUrlForItem } from '../../helpers/images';
import { getWikiUrlFromItem } from '../../helpers/wikiLinks';
import {
	fetchHistoricalPricingForItem,
	fetchHistoricalPricingForItems,
} from '../../helpers/fetchHistoricalPricing';
import { toTitleCase } from '../../helpers/titleCase';
import { getPlayerLink } from '../../../prisma/dbExecutors/playerLink';
import { gracefullyHandleError } from '../../helpers/errors';
import { getCachedPlayerDiscordName } from '../../helpers/redis';

const MAX_FIELD_VALUE = 1024;
function truncateForField(text: string, reservedChars = 0): string {
	const max = MAX_FIELD_VALUE - reservedChars;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const MAX_DESCRIPTION = 4096;
function truncateForDescription(text: string, reservedChars = 0): string {
	const max = MAX_DESCRIPTION - reservedChars;
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function watchCommandResponseBuilder(watchData: Watch) {
	// Helper function to generate the field value based on conditions
	function generateFieldValue(watchData: Watch, isKnownItem: boolean) {
		if (watchData.priceRequirement && isKnownItem) {
			const formattedPrice = formatPriceNumberToReadableString(
				watchData?.priceRequirement,
			);
			if (watchData.watchType === 'WTS') {
				return `This watch will trigger for all ${watchData.watchType} auctions with a price less than or equal to ${formattedPrice}.`;
			} else if (watchData.watchType === 'WTB') {
				return `This watch will trigger for all ${watchData.watchType} auctions with a price equal to or greater than ${formattedPrice}.`;
			}
		} else if (watchData.priceRequirement && !isKnownItem) {
			return `This watch will trigger for all ${watchData.watchType} auctions. Due to unreliable price parsing for custom items, your price requirement will not be considered when filtering auctions.`;
		}
		return `This watch will trigger for all ${watchData.watchType} auctions`;
	}

	const imgUrl = getImageUrlForItem(watchData.itemName);
	const wikiUrl = getWikiUrlFromItem(watchData.itemName);

	const price = watchData?.priceRequirement
		? `Price Criteria: ${formatPriceNumberToReadableString(
				watchData?.priceRequirement,
			)}`
		: 'No Price Criteria';
	const formattedExpirationTimestamp = formatWatchExpirationTimestamp(
		watchData.created,
	);

	const fields = [
		{
			name: `${price}`,
			value: generateFieldValue(watchData, !!wikiUrl), //	existence of wikiUrl is effectively the same as a true result from isKnownItem()
			inline: false,
		},
		{
			name: `Project 1999 ${formatserverEnumToReadableString(
				watchData.server,
			)} Server`,
			value: `${formattedExpirationTimestamp}`,
			inline: false,
		},
	];

	if (watchData.snoozedUntil) {
		const formattedSnoozeExpirationTimestamp =
			formatSnoozeExpirationTimestamp(watchData.snoozedUntil);
		fields.push({
			name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
			value: `${formattedSnoozeExpirationTimestamp}`,
			inline: false,
		});
	}

	if (watchData.notes) {
		fields.push({
			name: `Notes:`,
			value: truncateForField(watchData.notes),
			inline: false,
		});
	}

	const authorProperties: EmbedAuthorOptions = {
		name: watchData.itemName, //	itemName is intentionally left uppercase as a heading
	};

	if (imgUrl) {
		authorProperties.iconURL = imgUrl;
	}

	if (wikiUrl) {
		authorProperties.url = wikiUrl;
	}

	return new EmbedBuilder()
		.setColor(getServerColorFromString(watchData.server))
		.setAuthor(authorProperties)
		.setTitle(`${watchData.watchType} Auction Watch`)
		.addFields(fields)
		.setFooter({
			text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻️',
		});
}

export function watchesCommandResponseBuilder(dataForWatches: Watch[]) {
	return dataForWatches.map((watchData) => {
		return watchCommandResponseBuilder(watchData);
	});
}

export async function watchNotificationBuilder(
	watchData: Watch,
	player: string,
	auctionedPrice: number | undefined,
	auctionMessage: string,
) {
	const imgUrl = getImageUrlForItem(watchData.itemName);
	const wikiUrl = getWikiUrlFromItem(watchData.itemName);

	const historicalPricing = await fetchHistoricalPricingForItem(
		watchData.itemName,
		watchData.server,
	);

	const fields = [];

	if (watchData.notes) {
		fields.push({
			name: `Notes:`,
			value: `\`\`${truncateForField(watchData.notes, 4)}\`\``,
			inline: false,
		});
	}

	if (historicalPricing) {
		// Add fields for historical data
		fields.push({
			name: 'Historical Pricing (WTS)',
			value:
				`Last 30 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTSLast30DaysAverage,
				)} (Count: ${historicalPricing.totalWTSLast30DaysCount})\n` +
				`Last 60 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTSLast60DaysAverage,
				)} (Count: ${historicalPricing.totalWTSLast60DaysCount})\n` +
				`Last 90 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTSLast90DaysAverage,
				)} (Count: ${historicalPricing.totalWTSLast90DaysCount})\n` +
				`Last 6 Months Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTSLast6MonthsAverage,
				)} (Count: ${historicalPricing.totalWTSLast6MonthsCount})\n` +
				`Last Year Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTSLastYearAverage,
				)} (Count: ${historicalPricing.totalWTSLastYearCount})`,
			inline: true,
		});

		fields.push({
			name: 'Historical Pricing (WTB)',
			value:
				`Last 30 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTBLast30DaysAverage,
				)} (Count: ${historicalPricing.totalWTBLast30DaysCount})\n` +
				`Last 60 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTBLast60DaysAverage,
				)} (Count: ${historicalPricing.totalWTBLast60DaysCount})\n` +
				`Last 90 Days Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTBLast90DaysAverage,
				)} (Count: ${historicalPricing.totalWTBLast90DaysCount})\n` +
				`Last 6 Months Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTBLast6MonthsAverage,
				)} (Count: ${historicalPricing.totalWTBLast6MonthsCount})\n` +
				`Last Year Avg: ${formatPriceNumberToReadableString(
					historicalPricing.totalWTBLastYearAverage,
				)} (Count: ${historicalPricing.totalWTBLastYearCount})`,
			inline: true,
		});
	}

	// TODO: let's keep an on eye on this bug for now
	if (watchData.itemName.trim() === '') {
		const error = new Error(
			`itemName is an empty string for watch id: ${watchData.id}`,
		);
		await gracefullyHandleError(error);
		watchData.itemName = 'unknown item';
	}

	const authorProperties: EmbedAuthorOptions = {
		name: watchData.itemName, //	itemName is intentionally left uppercase as a heading
	};

	if (imgUrl) {
		authorProperties.iconURL = imgUrl;
	}

	if (wikiUrl) {
		authorProperties.url = wikiUrl;
	}

	const playerLink = await getPlayerLink(player, watchData.server);
	let playerLinkString = '';
	if (playerLink) {
		playerLinkString = ` (<@${playerLink.discordUserId}>)`;
	}

	const description = `\n\n\n**${player}**${playerLinkString} is currently ${
		watchData.watchType === WatchType.WTS ? 'selling' : 'buying'
	} **${toTitleCase(watchData.itemName)}** ${
		auctionedPrice
			? 'for **' +
				formatPriceNumberToReadableString(auctionedPrice) +
				'**'
			: ''
	} on **Project 1999 ${formatserverEnumToReadableString(
		watchData.server,
	)} Server**\n\n\`\`${player} auctions, ${auctionMessage}\`\`\n\n\n\n`;

	const title = `Watch Notification: ${toTitleCase(watchData.itemName)}`;

	return new EmbedBuilder()
		.setColor(getServerColorFromString(watchData.server))
		.setAuthor(authorProperties)
		.setTitle(title.length > 256 ? title.slice(0, 256) : title)
		.setDescription(truncateForDescription(description))
		.addFields(fields)
		.setFooter({
			text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo ignore auctions from this player for this watch, click 🔕\nTo extend this watch, click ♻️',
		});
}

export function playerlinkCommandResponseBuilder(linkData: PlayerLink) {
	if (linkData.server != null) {
		return new EmbedBuilder()
			.setColor(getServerColorFromString(linkData.server))
			.setTitle(`${linkData.player} (${linkData.server})`);
	}
}

function formatCapitalCase(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

export function formatserverEnumToReadableString(server: Server) {
	return formatCapitalCase(server);
}

export function listCommandResponseBuilder(
	watches: Watch[],
	user: User,
): EmbedBuilder[] {
	const FIELDS_PER_EMBED = 25;
	const MAX_EMBEDS = 10;
	const embeds: EmbedBuilder[] = [];

	if (isSnoozed(user.snoozedUntil)) {
		embeds.push(
			createSnoozeEmbed(
				'Global snooze is active. None of your watches will trigger notifications while active.',
			),
		);
	}

	const watchesByServer: { [key: string]: Watch[] } = {};
	watches.forEach((watch) => {
		if (!watchesByServer[watch.server]) watchesByServer[watch.server] = [];
		watchesByServer[watch.server].push(watch);
	});

	let truncated = false;
	const serverEntries = Object.entries(watchesByServer);
	serverEntries.forEach(([server, serverWatches], serverIndex) => {
		const fields: EmbedField[] = serverWatches.map((watch) => {
			const price = watch.priceRequirement
				? `${formatPriceNumberToReadableString(watch.priceRequirement)}`
				: 'no price criteria';
			const snoozeEmoji = isSnoozed(watch.snoozedUntil) ? '💤 ' : '';
			return {
				name: `\`${snoozeEmoji}${toTitleCase(
					watch.itemName,
				)}\` | \`${price}\``,
				value: `${formatWatchExpirationTimestamp(watch.created)}`,
				inline: false,
			};
		});

		const isLastServer = serverIndex === serverEntries.length - 1;
		for (let i = 0; i < fields.length; i += FIELDS_PER_EMBED) {
			if (embeds.length >= MAX_EMBEDS - 1) {
				truncated = true;
				break;
			}
			const chunk = fields.slice(i, i + FIELDS_PER_EMBED);
			const isLastChunk = i + FIELDS_PER_EMBED >= fields.length;
			embeds.push(
				createEmbed(server, chunk, isLastServer && isLastChunk),
			);
		}
	});

	if (truncated) {
		embeds.push(
			createInfoEmbed(
				'You have more watches than can be displayed in a single message. Some have been omitted.',
			),
		);
	}

	return embeds;
}

function createInfoEmbed(content: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor('#FF0000')
		.addFields({ name: '\u200b', value: content, inline: false });
}

function createEmbed(
	server: string,
	fields: EmbedField[],
	isLastEntry: boolean,
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setAuthor({ name: `Project 1999 ${formatCapitalCase(server)} Server` })
		.setColor(getServerColorFromString(server as Server))
		.addFields(fields);

	if (isLastEntry) {
		embed.setFooter({
			text: 'To snooze all watches for 6 hours, click 💤\nTo extend all watches, click ♻️',
		});
	}

	return embed;
}

function createSnoozeEmbed(content: string): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setColor('#FFA500') // You can choose your preferred color here
		.addFields({ name: '\u200b', value: content, inline: false }); // Unicode '\u200b' represents a zero-width space

	return embed;
}

export function blockCommandResponseBuilder(block: BlockedPlayer) {
	return new EmbedBuilder()
		.setColor(getServerColorFromString(block.server))
		.setAuthor({ name: 'Player Block' })
		.setTitle(`--- ${block.player} ---`)
		.setFooter({
			text: 'To remove this block, click ❌',
		});
}

export type HistoricalData = {
	eQitemId: number;
	itemName: string;
	server: number;
	lastWTBSeen: string | null;
	lastWTSSeen: string | null;
	totalWTSAuctionCount: number;
	totalWTSAuctionAverage: number;
	totalWTSLast30DaysCount: number;
	totalWTSLast30DaysAverage: number;
	totalWTSLast60DaysCount: number;
	totalWTSLast60DaysAverage: number;
	totalWTSLast90DaysCount: number;
	totalWTSLast90DaysAverage: number;
	totalWTSLast6MonthsCount: number;
	totalWTSLast6MonthsAverage: number;
	totalWTSLastYearCount: number;
	totalWTSLastYearAverage: number;
	totalWTBAuctionCount: number;
	totalWTBAuctionAverage: number;
	totalWTBLast30DaysCount: number;
	totalWTBLast30DaysAverage: number;
	totalWTBLast60DaysCount: number;
	totalWTBLast60DaysAverage: number;
	totalWTBLast90DaysCount: number;
	totalWTBLast90DaysAverage: number;
	totalWTBLast6MonthsCount: number;
	totalWTBLast6MonthsAverage: number;
	totalWTBLastYearCount: number;
	totalWTBLastYearAverage: number;
};

export async function embeddedAuctionStreamMessageBuilder(
	player: string,
	server: Server,
	auctionText: string,
	auctionData: AuctionData,
): Promise<EmbedBuilder[]> {
	const embeds: EmbedBuilder[] = [];
	const timestamp = new Date();

	const historicalPricing = await fetchHistoricalPricingForItems(
		auctionData,
		server,
	);

	const formatHistoricalPricingInfo = (
		historicalData: HistoricalData,
		type: 'buying' | 'selling', //	TODO: use watchType enum isntead of fragile string
	) => {
		const prefix = type === 'buying' ? 'WTB' : 'WTS';
		const fmt = (n: number | undefined | null) =>
			n == null ? '-' : formatPriceNumberToReadableString(n);
		const avg30 = fmt(historicalData[`total${prefix}Last30DaysAverage`]);
		const avg60 = fmt(historicalData[`total${prefix}Last60DaysAverage`]);
		const avg90 = fmt(historicalData[`total${prefix}Last90DaysAverage`]);
		const count30 = historicalData[`total${prefix}Last30DaysCount`] ?? 0;
		const count60 = historicalData[`total${prefix}Last60DaysCount`] ?? 0;
		const count90 = historicalData[`total${prefix}Last90DaysCount`] ?? 0;

		return `30 Day Avg: ${avg30} (of ${count30})\n 60 Day Avg: ${avg60} (of ${count60})\n 90 Day Avg: ${avg90} (of ${count90})`;
	};

	const generateItemFields = (
		items: ItemType[],
		type: 'buying' | 'selling',
		labelType: boolean,
	) => {
		if (items.length === 0) {
			return [];
		}

		const typePrefix = labelType
			? type === 'selling'
				? 'WTS: '
				: 'WTB: '
			: '';

		return items.map((item) => {
			const priceField = item.price
				? `${typePrefix}${formatPriceNumberToReadableString(item.price)}${item.perItem ? ' ea' : ''}`
				: `${typePrefix}No Price Listed`;
			const historicalData =
				(historicalPricing[item.item] as HistoricalData) || null;
			const wikiLink = getWikiUrlFromItem(item.item) || '';
			const hoverText = historicalData
				? formatHistoricalPricingInfo(historicalData, type)
				: `Could not find historical pricing for item ${item.item}`;
			const valueField = formatHoverText(
				toTitleCase(item.item),
				wikiLink,
				hoverText,
			);

			return {
				name: priceField,
				value: valueField,
				inline: true,
			};
		});
	};

	const hasBothTypes =
		auctionData.buying.length > 0 && auctionData.selling.length > 0;

	const sellingFields = generateItemFields(
		auctionData.selling,
		'selling',
		hasBothTypes,
	);
	const buyingFields = generateItemFields(
		auctionData.buying,
		'buying',
		hasBothTypes,
	);

	let title = '';
	if (hasBothTypes) {
		title += 'WTS/WTB';
	} else if (auctionData.buying.length > 0) {
		title += 'WTB';
	} else if (auctionData.selling.length > 0) {
		title += 'WTS';
	} else {
		// No items matched — detect WTB/WTS from the raw auction text
		const hasWtb = /\bWTB\b/i.test(auctionText);
		const hasWts = /\b(WTS|WTT)\b/i.test(auctionText);
		if (hasWtb && hasWts) {
			title += 'WTS/WTB';
		} else if (hasWtb) {
			title += 'WTB';
		} else if (hasWts) {
			title += 'WTS';
		}
	}

	const combinedFields: APIEmbedField[] = [];

	const playerLink = await getPlayerLink(player, server);
	if (playerLink) {
		let userLinkValue = `<@${playerLink.discordUserId}>`;
		const userName = await getCachedPlayerDiscordName(
			playerLink.discordUserId,
		);
		if (userName) {
			userLinkValue = userLinkValue + ` (@${userName})`;
		}
		combinedFields.push({
			name: 'Discord User',
			value: userLinkValue,
		});
	}

	combinedFields.push(...sellingFields, ...buyingFields);

	const FIELDS_PER_EMBED = 25;
	const MAX_EMBEDS = 10;

	const fieldChunks: APIEmbedField[][] = [];
	for (let i = 0; i < combinedFields.length; i += FIELDS_PER_EMBED) {
		fieldChunks.push(combinedFields.slice(i, i + FIELDS_PER_EMBED));
	}
	if (fieldChunks.length === 0) {
		fieldChunks.push([]);
	}

	fieldChunks.slice(0, MAX_EMBEDS).forEach((chunk, index) => {
		const embed = new EmbedBuilder()
			.setColor(getServerColorFromString(server))
			.addFields(chunk)
			.setTimestamp(timestamp);
		if (index === 0) {
			embed
				.setAuthor({ name: `[ ${title} ]   ${player}` })
				.setDescription(
					`\`\`\`${truncateForDescription(auctionText, 6)}\`\`\``,
				);
		}
		if (index === Math.min(fieldChunks.length, MAX_EMBEDS) - 1) {
			embed.setFooter({
				text: `Project 1999 ${formatCapitalCase(server)}`,
			});
		}
		embeds.push(embed);
	});

	return embeds;
}

export function formatHoverText(
	displayText: string,
	wikiUrl: string,
	hoverText: string = ' ',
): string {
	const defaultWikiUrl = getEnvironmentVariable('WIKI_BASE_URL');
	const safeHover = hoverText.replace(/"/g, "'");
	return `[${displayText}](${wikiUrl || defaultWikiUrl} "${safeHover}")`;
}
