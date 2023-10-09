import { Server } from '@prisma/client';
import { Tail } from 'tail';
import {
	getLogFilePath,
	getMatchingItemsFromText,
	isFalsePositiveItemMatch,
} from './helpers';
import { state } from './state';
import { Trie } from './trieSearch';
import inGameItemsObject from '../content/gameData/items.json';

export function isAuctionOfInterest(
	text: string,
	watchedItems: { [item: string]: number[] },
): boolean {
	return Object.keys(watchedItems).some((item) => text.includes(item));
}

// function findMatchingItem(itemGroup: string): string | null {
// 	if (isExactItemMatch(itemGroup.trim())) return itemGroup.trim();

// 	const strippedItem = itemGroup
// 		.replace(/\s*\d+(\.\d{1,2})?(pp|k)?\s*$/, '')
// 		.trim();
// 	if (isExactItemMatch(strippedItem)) return strippedItem;

// 	// Split potential item group by space
// 	const items = itemGroup.split(/\s+/);

// 	// Progressively check larger item names for a match
// 	for (let start = 0; start < items.length; start++) {
// 		for (let end = start + 1; end <= items.length; end++) {
// 			const itemName = items.slice(start, end).join(' ');
// 			if (
// 				itemTrie.search(itemName) &&
// 				!isFalsePositiveItemMatch(itemName, itemGroup)
// 			) {
// 				return itemName;
// 			}
// 		}
// 	}

// 	return null;
// }

export class AuctionParser {
	private itemTrie: Trie;
	private delimiters = [',', '-', '/', '\\', '|'];
	private auctionTypes = [
		'WTS',
		'WTB',
		'want to sell',
		'selling',
		'want to buy',
		'buying',
	];
	private priceRegex = /(\d+(\.\d{1,2})?(pp|k)?)$/;

	constructor() {
		this.itemTrie = new Trie();
		for (const itemName of Object.keys(inGameItemsObject)) {
			this.itemTrie.insert(itemName);
		}
	}

	private longestMatchFromTrie(s: string): string | null {
		let word = '';
		let temp = '';
		for (const char of s) {
			temp += char;
			if (this.itemTrie.search(temp)) {
				word = temp;
			}
		}
		return word || null;
	}

	public parseAuction(auction: string) {
		const buying: { item: string; price: string | null }[] = [];
		const selling: { item: string; price: string | null }[] = [];

		const parts: { type: string; text: string }[] = [];
		let remainingAuction = auction;
		for (const type of this.auctionTypes) {
			const splitParts = remainingAuction.split(new RegExp(type, 'gi'));
			if (splitParts.length > 1) {
				parts.push({ type, text: splitParts[0].trim() });
				remainingAuction = splitParts[1];
			}
		}
		parts.push({ type: 'WTS', text: remainingAuction.trim() });

		for (const part of parts) {
			let segments = [part.text.trim()];

			while (segments.length) {
				const currentSegment = segments.shift();
				if (!currentSegment) {
					continue; // Continue if currentSegment is undefined
				}
				let match = this.longestMatchFromTrie(currentSegment);

				let price: string | null = null;
				const priceMatch = this.priceRegex.exec(currentSegment);
				if (priceMatch) {
					price = priceMatch[0];
				}

				if (match) {
					const item = currentSegment.substr(0, match.length).trim();
					const remaining = currentSegment
						.substr(match.length)
						.trim();

					if (
						part.type.includes('WTB') ||
						part.type.includes('want to buy') ||
						part.type.includes('buying')
					) {
						buying.push({ item, price });
					} else {
						selling.push({ item, price });
					}

					if (remaining) segments.push(remaining);
				} else {
					const delimiterIndex = this.delimiters
						.map((d) => currentSegment.indexOf(d))
						.filter((idx) => idx !== -1)
						.filter((idx) => idx !== undefined) // Filtering out undefined values
						.sort((a, b) => a! - b!)[0]; // Using the non-null assertion operator
					if (delimiterIndex !== undefined) {
						const unmatchedItem = currentSegment
							.substring(0, delimiterIndex)
							.trim();
						const nextSegment = currentSegment
							.substr(delimiterIndex + 1)
							.trim();

						if (
							part.type.includes('WTB') ||
							part.type.includes('want to buy') ||
							part.type.includes('buying')
						) {
							buying.push({ item: unmatchedItem, price });
						} else {
							selling.push({ item: unmatchedItem, price });
						}

						if (nextSegment) segments.push(nextSegment);
					} else {
						if (
							part.type.includes('WTB') ||
							part.type.includes('want to buy') ||
							part.type.includes('buying')
						) {
							buying.push({ item: currentSegment, price });
						} else {
							selling.push({ item: currentSegment, price });
						}
					}
				}

				// Normalize spaces for next iteration
				segments = segments.map((s) => s.replace(/\s+/g, ' ').trim());
			}
		}

		return { buying, selling };
	}
}

const parser = new AuctionParser();

// function addToBuyOrSell(
// 	type: string,
// 	item: string,
// 	price: string | null,
// 	buying: { item: string; price: string | null }[],
// 	selling: { item: string; price: string | null }[],
// ) {
// 	if (type && type.toLowerCase().includes('buy')) {
// 		buying.push({ item, price });
// 	} else {
// 		selling.push({ item, price });
// 	}
// }

// // Check if item is an exact match from JSON
// function isExactItemMatch(item: string): boolean {
// 	return !!inGameItemsObject[
// 		item.toUpperCase() as keyof typeof inGameItemsObject
// 	];
// }

export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);
	const tail = new Tail(logFilePath);

	tail.on('line', function (data) {
		console.log(data);
		const auctionMatch = data.match(/(\w+) auctions, '(.+)'/);
		if (!auctionMatch) return;

		const [, playerName, auctionText] = auctionMatch;
		const auctionData = parser.parseAuction(auctionText);
		console.log(auctionText);
		console.log('auctionData = ', auctionData);

		// const matchingItemsFromAuction = getMatchingItemsFromText(
		// 	auctionText,
		// 	server,
		// );

		// if (!matchingItemsFromAuction) return;
		// // console.log(playerName, auctionText, auctionData)

		// // Collecting watchIds for matched items that need notifications
		// const notifyWatchIds: number[] = [];

		// for (const item of matchingItemsFromAuction.WTB) {
		// 	if (
		// 		auctionData.buying.some(
		// 			(buyingItem) => buyingItem.item === item,
		// 		)
		// 	) {
		// 		// Add all watch IDs associated with this item to the notify list
		// 		notifyWatchIds.push(...state.watchedItems[server].WTB[item]);
		// 	}
		// }

		// for (const item of matchingItemsFromAuction.WTS) {
		// 	if (
		// 		auctionData.selling.some(
		// 			(sellingItem) => sellingItem.item === item,
		// 		)
		// 	) {
		// 		// Add all watch IDs associated with this item to the notify list
		// 		notifyWatchIds.push(...state.watchedItems[server].WTS[item]);
		// 	}
		// }

		// TODO: Use the notifyWatchIds list to trigger necessary messages/alerts
		// for each watchId, confirm the watch is still active, not snoozed by watch or user, or last notified within 15 mins
		// send watch notification and update last notified time
		// eslint-disable-next-line no-console
	});

	tail.on('error', function (error) {
		// eslint-disable-next-line no-console
		console.error('LOG PARSER ERROR: ', error);
	});
}
