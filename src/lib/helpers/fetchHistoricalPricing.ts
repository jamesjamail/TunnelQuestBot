/* eslint-disable prettier/prettier */
import { Server } from '@prisma/client';
import { redis } from '../../redis/init';
import { AuctionData } from '../content/streams/streamAuction';
import { HistoricalData } from '../content/messages/messageBuilder';

// Helper function to generate a Redis key based on item name and server
function generateRedisKey(itemName: string, server: Server) {
	return `historical:${server}:${itemName}`;
}

// TODO: confirm Prisma Server enum matches pig parse Sever enum
function getServerIntForExternalApi(server: Server) {
	return Server[server];
}

export async function fetchHistoricalPricingForItem(
	itemName: string,
	server: Server,
) {
	const key = generateRedisKey(itemName, server);
	let historicalPrice = await redis.get(key);

	if (!historicalPrice) {
		const endpoint = `${
			process.env.HISTORICAL_AUCTION_DATA_API
		}/api/item/get/${getServerIntForExternalApi(
			server,
		)}/${encodeURIComponent(itemName)}`;
		const res = await fetch(endpoint);

		if (res.status === 204) {
			return null;
		}

		if (!res.ok) {
			// eslint-disable-next-line no-console
			console.error(res.status, endpoint);
			return null;
		}

		historicalPrice = await res.json();
		await redis.set(key, JSON.stringify(historicalPrice));
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
