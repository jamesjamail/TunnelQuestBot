import { load } from 'cheerio';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { consolidatedItems } from '../content/gameData/consolidatedItems';
import { AuctionData } from '../content/streams/streamAuction';
import axios from 'axios';

const agent = new https.Agent({
	ca: fs.readFileSync(
		path.resolve(__dirname, '../certificates/fullchain.pem'),
	),
});

const instance = axios.create({
	httpsAgent: new https.Agent({
		ca: fs.readFileSync(
			path.resolve(__dirname, '../certificates/fullchain.pem'),
		),
	}),
});

const BASE_WIKI_URL = 'https://wiki.project1999.com';

interface PriceData {
	[days: number]: string;
}

interface CacheEntry {
	data: PriceData;
	expiry: number;
}

// In-memory cache setup
const cache: Record<string, CacheEntry> = {};
const cache_expiration = 1 * 24 * 60 * 60 * 1000;

export function parsePage(page: string, server: string): PriceData {
	const $ = load(page);
	const aucData = $(`#auc_${server} .eoTable3 td`);

	const priceData: PriceData = {
		30: aucData.eq(0).text().trim(),
		90: aucData.eq(1).text().trim(),
	};

	return priceData;
}

export async function findWikiData(
	auctionData: AuctionData,
	// server: string,
): Promise<Record<string, [string | null, PriceData]>> {
	const allAuctionData = [...auctionData.buying, ...auctionData.selling];
	const wikiData: Record<string, [string | null, PriceData]> = {};

	for (const itemData of allAuctionData) {
		let link;

		if (consolidatedItems[itemData.item.toUpperCase()]) {
			link =
				BASE_WIKI_URL + consolidatedItems[itemData.item.toUpperCase()];
		}

		if (link) {
			// TODO: p99 wiki has borked certs...not sure we can access them
			// const historicalPricing = await getWikiPricing(link, server);
			// wikiData[link] = [itemData.price || null, historicalPricing];
		}
	}

	return wikiData;
}

export async function getWikiPricing(
	itemUrl: string,
	server: string,
): Promise<PriceData> {
	server = server.charAt(0).toUpperCase() + server.slice(1).toLowerCase();
	const key = `${itemUrl}_${server}`;
	const currentTime = Date.now();

	if (cache[key] && cache[key].expiry > currentTime) {
		return cache[key].data;
	}

	try {
		// Axios usage
		const response = await instance.get(itemUrl, { httpAgent: agent });

		if (response.status !== 200)
			throw new Error('Network response was not ok');

		const pageData = response.data;
		const priceData = parsePage(pageData, server);

		// Cache the data
		cache[key] = {
			data: priceData,
			expiry: currentTime + cache_expiration,
		};

		return priceData;
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(
			`There was a problem with the fetch operation for ${itemUrl}: ${error.message}`,
		);
		throw error;
	}
}
