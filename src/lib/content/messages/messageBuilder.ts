import { Watch, Server, User, BlockedPlayer } from '@prisma/client';
import { APIEmbedField, EmbedAuthorOptions, EmbedBuilder } from 'discord.js';
import {
	formatSnoozeExpirationTimestamp,
	formatWatchExpirationTimestamp,
} from '../../helpers/datetime';
import { getServerColorFromString } from '../../helpers/colors';
import { EmbedField } from 'discord.js';
import { isSnoozed } from '../../helpers/helpers';
import { AuctionData } from '../streams/streamAuction';
import { getImageUrlForItem } from '../../helpers/images';
import { getWikiUrlFromItem } from '../../helpers/wikiLinks';

export function watchCommandResponseBuilder(watchData: Watch) {
	const imgUrl = getImageUrlForItem(watchData.itemName);
	const wikiUrl = getWikiUrlFromItem(watchData.itemName);

	const price = watchData.priceRequirement ?? 'No Price Criteria';
	const formattedExpirationTimestamp = formatWatchExpirationTimestamp(
		watchData.created,
	);
	const fields = [
		{
			name: `${price}`,
			// TODO: make this conditional based on watchType
			value: `This watch will trigger for all ${watchData.watchType} auctions`,
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
			value: watchData.notes,
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

function formatCapitalCase(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

export function formatserverEnumToReadableString(server: Server) {
	return server[0] + server.slice(1).toLowerCase();
}

export function listCommandResponseBuilder(
	watches: Watch[],
	user: User,
): EmbedBuilder[] {
	const watchesByServer: { [key: string]: Watch[] } = {};
	const globalSnooze = isSnoozed(user.snoozedUntil);
	const embeds: EmbedBuilder[] = [];
	let totalFieldsCount = 0;

	if (watches.length > 25) {
		embeds.push(
			createInfoEmbed(
				'You have more watches than can be displayed in a single message. Some have been omitted.',
			),
		);
		totalFieldsCount++; // Incremented here after pushing info embed
	}

	if (globalSnooze) {
		embeds.push(
			createSnoozeEmbed(
				'Global snooze is active. None of your watches will trigger notifications while active.',
			),
		);
		totalFieldsCount++; // Incremented here after pushing snooze embed
	}

	watches.forEach((watch) => {
		if (!watchesByServer[watch.server]) watchesByServer[watch.server] = [];
		watchesByServer[watch.server].push(watch);
	});

	const serverEntries = Object.entries(watchesByServer);
	serverEntries.forEach(([server, serverWatches], index) => {
		let fields: EmbedField[] = [];

		serverWatches.forEach((watch) => {
			if (totalFieldsCount >= 25) return;

			const price = watch.priceRequirement
				? `$${watch.priceRequirement}`
				: 'no price criteria';

			const snoozeEmoji = isSnoozed(watch.snoozedUntil) ? '💤 ' : '';

			const watchFields: EmbedField[] = [
				{
					name: `\`${snoozeEmoji}${formatCapitalCase(
						watch.itemName,
					)}\` | \`${price}\``,
					value: `${formatWatchExpirationTimestamp(watch.created)}`,
					inline: false,
				},
			];

			if (fields.length + watchFields.length + totalFieldsCount > 25) {
				embeds.push(createEmbed(server, fields, false));
				fields = [];
			}

			fields.push(...watchFields);
			totalFieldsCount++;
		});

		const isLastEmbed = index === serverEntries.length - 1; // Check if it's the last server entry
		embeds.push(createEmbed(server, fields, isLastEmbed));
	});

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
	// const fields = [
	// 	{
	// 		name: `${block.watchType}   |   ${price}`,
	// 		// TODO: make this conditional based on watchType
	// 		value: 'This watch will only trigger for WTS auctions',
	// 		inline: false,
	// 	},
	// 	{
	// 		name: `Project 1999 ${block.server} Server`,
	// 		value: `${formattedExpirationTimestamp}`,
	// 		inline: false,
	// 	},
	// ];

	return new EmbedBuilder()
		.setColor(getServerColorFromString(block.server))
		.setAuthor({ name: 'Player Block' })
		.setTitle(`--- ${block.player} ---`)
		.setFooter({
			text: 'To remove this block, click ❌',
		});
}

export async function embeddedAuctionStreamMessageBuilder(
	player: string,
	server: Server,
	auctionText: string,
	auctionData: AuctionData,
): Promise<EmbedBuilder[]> {
	// Return type updated to Promise<EmbedBuilder[]>
	const embeds: EmbedBuilder[] = [];
	const timestamp = new Date();

	// TODO: historical pricing

	let title = '';
	// const buyingFields = auctionData.buying.map((buyItem) => {
	// 	// If the wiki has data on this item, append to its value
	// 	const wikiLink =
	// 		wikiData[
	// 			BASE_WIKI_URL + consolidatedItems[buyItem.item.toUpperCase()]
	// 		]?.[1]?.[30] || ''; // This takes the 30-day average price. Adjust as necessary.

	// 	return {
	// 		name: buyItem.price ? `Price: ${buyItem.price}` : '-',
	// 		value: `${buyItem.item} ${wikiLink}`, // appended wiki data here
	// 		inline: true,
	// 	};
	// });

	// const sellingFields = auctionData.selling.map((sellItem) => {
	// 	// If the wiki has data on this item, append to its value
	// 	const wikiLink =
	// 		wikiData[
	// 			BASE_WIKI_URL + consolidatedItems[sellItem.item.toUpperCase()]
	// 		]?.[1]?.[30] || ''; // This takes the 30-day average price. Adjust as necessary.

	// 	return {
	// 		name: sellItem.price ? `Price: ${sellItem.price}` : '-',
	// 		value: `${sellItem.item} ${wikiLink}`, // appended wiki data here
	// 		inline: true,
	// 	};
	// });

	if (auctionData.buying.length > 0 && auctionData.selling.length > 0) {
		title += 'WTS/WTB';
	} else if (auctionData.buying.length > 0) {
		title += 'WTB';
	} else if (auctionData.selling.length > 0) {
		title += 'WTS';
	}

	const combinedFields: APIEmbedField | APIEmbedField[] = [];

	embeds.push(
		new EmbedBuilder()
			.setColor(getServerColorFromString(server))
			.setAuthor({ name: `[ ${title} ]   ${player}` })
			.setTitle(`\`\`\`${auctionText}\`\`\``)
			.addFields(combinedFields)
			.setFooter({ text: `Project 1999 ${formatCapitalCase(server)}` })
			.setTimestamp(timestamp),
	);

	return embeds;
}
