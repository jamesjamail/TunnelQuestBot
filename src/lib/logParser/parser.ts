import { Server } from '@prisma/client';
import { Tail } from 'tail';
import { getLogFilePath } from './helpers';
import { state } from './state';
import { Trie } from './trieSearch';
import inGameItemsObject from '../content/gameData/items.json';

export function isAuctionOfInterest(
	text: string,
	watchedItems: { [item: string]: number[] },
): boolean {
	return Object.keys(watchedItems).some((item) => text.includes(item));
}

export class AuctionParser {
	private itemTrie: Trie;

	constructor() {
		this.itemTrie = new Trie();
		for (const itemName of Object.keys(inGameItemsObject)) {
			this.itemTrie.insert(itemName);
		}
	}

	private preprocessMessage(msg: string): string {
		return msg.replace(/PST[.,!]*\s*(to\s+\w+)?/gi, '').trim();
	}

	private determineAction(segment: string): string | null {
		if (segment.includes('WTS')) {
			return 'sell';
		} else if (segment.includes('WTB')) {
			return 'buy';
		}
		return null;
	}

	private extractPrice(
		segment: string,
	): { originalPrice: string; value: string; unit?: string } | null {
		const pricePattern =
			/ (\d+(\.\d+)?)(k(pp)?|pp)?(?=\s|\b|[|,/*\\\-_~])/i;
		const priceMatch = segment.match(pricePattern);

		if (!priceMatch) return null;

		const originalPrice = priceMatch[0];

		let priceValue: string = priceMatch[1];
		let unit: string | undefined;

		if (priceMatch[3] === 'k' || priceMatch[3] === 'kpp') {
			unit = 'k';
			priceValue = (parseFloat(priceValue) * 1000).toString();
		} else if (priceMatch[3] === 'pp') {
			unit = 'pp';
		}

		if (priceValue && parseInt(priceValue) < 50 && !unit) {
			return null;
		}

		return {
			originalPrice,
			value: priceValue,
			unit: unit,
		};
	}

	private longestItemMatch(segment: string): string | undefined {
		let currentItem = '';
		for (let i = 0; i < segment.length; i++) {
			currentItem += segment[i];
			if (this.itemTrie.search(currentItem.slice(0, i + 1))) {
				continue;
			} else {
				currentItem = currentItem.slice(0, -1);
				if (this.itemTrie.search(currentItem)) {
					return currentItem;
				}
				currentItem = '';
			}
		}
		if (this.itemTrie.search(currentItem)) {
			return currentItem;
		}
		return undefined;
	}

	private parseSegment(segment: string, action: string) {
		const newAction = this.determineAction(segment);
		if (newAction) {
			action = newAction;
			segment = segment.replace(newAction, '').trim();
		}

		const priceDetails = this.extractPrice(segment);
		const potentialPrice = priceDetails ? priceDetails.value : null;
		let potentialItem = segment;

		if (potentialPrice && priceDetails) {
			potentialItem = this.removePriceFromSegment(
				potentialItem,
				priceDetails,
			);
		}

		const itemMatch = this.longestItemMatch(potentialItem);
		if (itemMatch) {
			potentialItem = itemMatch;
		}

		return {
			action,
			item: potentialItem.trim(),
			price: potentialPrice,
		};
	}

	private removePriceFromSegment(
		segment: string,
		priceDetails: { originalPrice: string; value: string; unit?: string },
	): string {
		const { originalPrice } = priceDetails;
		const pricePattern = new RegExp(`\\s?${originalPrice}\\s?`, 'i');
		return segment.replace(pricePattern, '').trim();
	}

	private splitSegment(segment: string): string[] {
		const delimiters = [
			/[/]/,
			/[-]/,
			/[_]/,
			/[|]/,
			/[~]/,
			/[*]/,
			/[,]/,
			/[\\]/,
		];
		const splitPattern = new RegExp(
			delimiters.map((d) => d.source).join('|'),
			'g',
		);

		const parts = segment.split(splitPattern);

		for (let i = 0; i < parts.length; i++) {
			if (!this.itemTrie.search(parts[i]) && i < parts.length - 1) {
				const combined = (parts[i] + ' ' + parts[i + 1]).trim();
				if (this.itemTrie.search(combined)) {
					parts[i] = combined;
					parts.splice(i + 1, 1);
					i--;
				}
			}
		}

		return parts.filter((part) => part && part.trim() !== '');
	}

	private splitByAction(auctionMsg: string): { wts: string; wtb: string } {
		const splitPoint = auctionMsg.indexOf('WTB');
		if (splitPoint !== -1) {
			return {
				wts: auctionMsg
					.substring(0, splitPoint)
					.replace(/WTS/i, '')
					.trim(),
				wtb: auctionMsg
					.substring(splitPoint)
					.replace(/WTB/i, '')
					.trim(),
			};
		} else {
			return {
				wts: auctionMsg.replace(/WTS/i, '').trim(),
				wtb: '',
			};
		}
	}

	public parseAuction(auctionMsg: string) {
		auctionMsg = this.preprocessMessage(auctionMsg);
		const { wts, wtb } = this.splitByAction(auctionMsg);

		const buying: { item: string; price?: string | null }[] = [];
		const selling: { item: string; price?: string | null }[] = [];

		const wtsSegmentsRaw = wts.split(/[/\-_|~*,]|\s{2,}/);
		let wtsSegments: string[] = [];
		for (const segment of wtsSegmentsRaw) {
			wtsSegments = wtsSegments.concat(this.splitSegment(segment));
		}

		const wtbSegmentsRaw = wtb.split(/[/\-_|~*,]/);
		let wtbSegments: string[] = [];
		for (const segment of wtbSegmentsRaw) {
			wtbSegments = wtbSegments.concat(this.splitSegment(segment));
		}

		for (const segment of wtsSegments) {
			const result = this.parseSegment(segment.trim(), 'sell');
			selling.push({
				item: result.item,
				price: result.price,
			});
		}

		for (const segment of wtbSegments) {
			const result = this.parseSegment(segment.trim(), 'buy');
			buying.push({
				item: result.item,
				price: result.price,
			});
		}

		return {
			buying,
			selling,
		};
	}
}

const parser = new AuctionParser();

export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);
	const tail = new Tail(logFilePath);

	tail.on('line', function (data) {
		const auctionMatch = data.match(/(\w+) auctions, '(.+)'/);
		if (!auctionMatch) return;

		const [, playerName, auctionText] = auctionMatch;
		console.log(playerName, auctionText);
		const auctionData = parser.parseAuction(auctionText);
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
