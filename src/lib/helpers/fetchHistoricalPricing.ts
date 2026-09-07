import { config } from '../../config';
import { Server } from '../../prisma/client';
import { redis } from '../../redis/init';
import type { AuctionData } from '../streams/streamAuction';
import type { HistoricalData } from '../content/messages/messageBuilder';
import { normalizeStoredWatchItemName } from './watches';

// Helper function to generate a Redis key based on item name and server
function generateRedisKey(itemName: string, server: Server) {
	return `historical:${server}:${itemName}`;
}

// TODO: confirm Prisma Server enum matches pig parse Sever enum
function getServerIntForExternalApi(server: Server) {
	return Server[server];
}

function logUnavailablePricing(
	server: Server,
	itemName: string,
	error: unknown,
): void {
	const reason =
		error instanceof Error
			? `${error.name}: ${error.message}`
			: String(error);
	console.warn(
		`Historical pricing unavailable for ${server}/${itemName}; continuing without it (${reason})`,
	);
}

export async function fetchHistoricalPricingForItem(
	itemName: string,
	server: Server,
) {
	const pricingItemName = normalizeStoredWatchItemName(itemName);
	const key = generateRedisKey(pricingItemName, server);
	let historicalPrice = await redis.get(key);

	if (!historicalPrice) {
		const endpoint = `${
			config().HISTORICAL_AUCTION_DATA_API
		}/api/item/get/${getServerIntForExternalApi(
			server,
		)}/${encodeURIComponent(pricingItemName)}`;
		let res: Response;
		try {
			res = await fetch(endpoint);
		} catch (error) {
			logUnavailablePricing(server, pricingItemName, error);
			return null;
		}

		if (res.status === 204) {
			return null;
		}

		if (!res.ok) {
			console.error(res.status, endpoint);
			return null;
		}

		try {
			historicalPrice = await res.json();
		} catch (error) {
			logUnavailablePricing(server, pricingItemName, error);
			return null;
		}
		await redis.set(
			key,
			JSON.stringify(historicalPrice),
			'EX',
			60 * 60 * 6,
		);
	} else {
		historicalPrice = JSON.parse(historicalPrice);
	}

	return historicalPrice as HistoricalData | null;
}

// Fetch historical pricing for multiple items from AuctionData
export async function fetchHistoricalPricingForItems(
	auctionData: AuctionData,
	server: Server,
) {
	const results: { [key: string]: unknown } = {};

	for (const buyingItem of auctionData.buying) {
		const itemName = buyingItem.item;
		results[itemName] = await fetchHistoricalPricingForItem(
			itemName,
			server,
		);
	}

	for (const sellingItem of auctionData.selling) {
		const itemName = sellingItem.item;
		results[itemName] = await fetchHistoricalPricingForItem(
			itemName,
			server,
		);
	}

	return results;
}
