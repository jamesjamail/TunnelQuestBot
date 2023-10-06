import { Server } from '@prisma/client';
import { Tail } from 'tail';
import {
	getLogFilePath,
	getMatchingItemsFromText,
	isFalsePositiveItemMatch,
} from './helpers';
import { state } from './state';

export function isAuctionOfInterest(
	text: string,
	watchedItems: { [item: string]: number[] },
): boolean {
	return Object.keys(watchedItems).some((item) => text.includes(item));
}

export function extractDataFromAuction(text: string) {
	const buySellRegex =
		/(WTS|WTB|want to sell|selling|want to buy|buying)?\s*([^\d\s/-_\\]+)(?:\s*(\d+))?/gi;
	let match;
	const buying: { item: string; price: string | null }[] = [];
	const selling: { item: string; price: string | null }[] = [];

	while ((match = buySellRegex.exec(text)) !== null) {
		const [, type, potentialItem, price] = match;

		// Check if this item isn't a false positive based on watchedItems
		if (!isFalsePositiveItemMatch(potentialItem, text)) {
			if (type && /WTB|want to buy|buying/i.test(type)) {
				buying.push({ item: potentialItem, price: price || null });
			} else {
				selling.push({ item: potentialItem, price: price || null });
			}
		}
	}
	return { buying, selling };
}
export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);
	const tail = new Tail(logFilePath);

	tail.on('line', function (data) {
		const auctionMatch = data.match(/(\w+) auctions, '(.+)'/);
		if (!auctionMatch) return;

		const [, playerName, auctionText] = auctionMatch;

		const matchingItemsFromAuction = getMatchingItemsFromText(
			auctionText,
			server,
		);
		if (!matchingItemsFromAuction) return;

		const auctionData = extractDataFromAuction(auctionText);

		// Collecting watchIds for matched items that need notifications
		const notifyWatchIds: number[] = [];

		for (const item of matchingItemsFromAuction.WTB) {
			if (
				auctionData.buying.some(
					(buyingItem) => buyingItem.item === item,
				)
			) {
				// Add all watch IDs associated with this item to the notify list
				notifyWatchIds.push(...state.watchedItems[server].WTB[item]);
			}
		}

		for (const item of matchingItemsFromAuction.WTS) {
			if (
				auctionData.selling.some(
					(sellingItem) => sellingItem.item === item,
				)
			) {
				// Add all watch IDs associated with this item to the notify list
				notifyWatchIds.push(...state.watchedItems[server].WTS[item]);
			}
		}

		// TODO: Use the notifyWatchIds list to trigger necessary messages/alerts
		// for each watchId, confirm the watch is still active, not snoozed by watch or user, or last notified within 15 mins
		// send watch notification and update last notified time
		// eslint-disable-next-line no-console
		console.log(notifyWatchIds, playerName, auctionData);
	});

	tail.on('error', function (error) {
		// eslint-disable-next-line no-console
		console.error('LOG PARSER ERROR: ', error);
	});
}
