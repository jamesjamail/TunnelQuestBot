import { Server } from '../../prisma/client';
import { isPast } from 'date-fns';
import {
	consolidatedItemsAndAliases,
	resolveCanonicalItemName,
} from '../gameData/consolidatedItems';

export function isSnoozed(timestamp: Date | null) {
	// null value indicates no snooze
	if (!timestamp) return false;

	const snoozedUntil = new Date(timestamp);
	return !isPast(snoozedUntil) as boolean;
}

export function formatServerFromEnum(server: Server) {
	return `Project 1999 ${server.toLowerCase()} server`;
}

export function formatPriceNumberToReadableString(price: number | '-'): string {
	if (price === '-') {
		return price;
	}

	if (price < 1000) {
		// Price is less than 1000
		return price + 'pp';
	} else {
		// Calculate price in thousands with two decimal places
		const priceInThousands = price / 1000;
		const roundedPrice = Math.round(priceInThousands * 100) / 100; // Round to two decimal places

		if (roundedPrice * 1000 === price) {
			// If rounded value multiplied by 1000 equals the original price, use the 'k' format
			return roundedPrice + 'k';
		} else {
			// Otherwise, format with commas and append 'pp'
			const formattedPrice = price.toLocaleString('en-US');
			return formattedPrice + 'pp';
		}
	}
}

export function isKnownItem(item: string) {
	return !!consolidatedItemsAndAliases[item.toUpperCase()];
}

// 	Known aliases such as FBSS are stored under their canonical item name so
// 	pricing APIs, thumbnails, and duplicate watches all behave consistently.
export function normalizeStoredWatchItemName(itemName: string): string {
	const upper = itemName.toUpperCase();
	if (isKnownItem(upper)) {
		return resolveCanonicalItemName(upper);
	}
	return upper;
}
