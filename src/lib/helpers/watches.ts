import { Server } from '@prisma/client';
import { isPast } from 'date-fns';
import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';

export function isSnoozed(timestamp: Date | null) {
	// null value indicates no snooze
	if (!timestamp) return false;

	const snoozedUntil = new Date(timestamp);
	return !isPast(snoozedUntil) as boolean;
}

export function formatServerFromEnum(server: Server) {
	return `Project 1999 ${server.toLowerCase()} server`;
}

export function lastAlertedMoreThanFifteenMinutesAgo(timestamp: Date | null) {
	if (!timestamp) return true;

	const lastAlerted = new Date(timestamp);
	const fifteenMinutesAgo = new Date();
	fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

	return lastAlerted < fifteenMinutesAgo;
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
