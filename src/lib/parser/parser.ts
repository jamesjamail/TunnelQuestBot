import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';
import { ItemType } from '../streams/streamAuction';

// Oldschool JS lib works the best of all the options :(

const AhoCorasick = require('ahocorasick');

export enum AuctionTypes {
	'WTS',
	'WTB',
}

export class AuctionParser {
	private aho;

	constructor(items?: string[]) {
		this.aho = new AhoCorasick(
			items ?? Object.keys(consolidatedItemsAndAliases),
		);
	}

	private preprocessMessage(msg: string): string {
		let processedMsg = msg.replace(/\bWTT\b/gi, 'WTS');

		processedMsg = processedMsg
			.replace(
				/\/WTT\b|\b(ASKING|OBO|OFFERS|OR BEST OFFER|TRADE|OR TRADE|PST)\b|!/gi,
				'',
			)
			.trim();

		return processedMsg;
	}

	// Thanks rici from StackOverflow for saving me time!
	// Based on https://stackoverflow.com/a/30472781
	private composeRanges(ranges: { start: number; end: number }[]) {
		const starts = ranges
			.map(function (r) {
				return r.start;
			})
			.sort(function (a, b) {
				return a - b;
			});
		const ends = ranges
			.map(function (r) {
				return r.end;
			})
			.sort(function (a, b) {
				return a - b;
			});
		let i = 0,
			j = 0,
			active = 0;
		const n = ranges.length;
		const combined: { start: number; end: number }[] = [];

		while (true) {
			if (i < n && starts[i] < ends[j]) {
				if (active++ === 0)
					combined.push({ start: starts[i], end: -1 });
				++i;
			} else if (j < n) {
				if (--active === 0) combined[combined.length - 1].end = ends[j];
				++j;
			} else {
				break;
			}
		}
		return combined;
	}

	public parseAuctionMessage(message: string): {
		buying: ItemType[];
		selling: ItemType[];
	} {
		const buying: ItemType[] = [];
		const selling: ItemType[] = [];

		const preprocessedMessage = this.preprocessMessage(message);
		const results = this.aho.search(preprocessedMessage);
		const matchRanges: { start: number; end: number }[] = [];
		for (const i in results) {
			const item = results[i];
			matchRanges.push({
				start: item[0] - item[1][0].length + 1,
				end: item[0] + 1,
			});
		}
		const composedRanges = this.composeRanges(matchRanges);

		let currentAuctionType = AuctionTypes.WTS;

		for (let i = 0; i < composedRanges.length; i++) {
			const range = composedRanges[i];
			const item = preprocessedMessage
				.substring(range.start, range.end)
				.trim();
			if (item === '') continue;

			// Prefix gap: text between previous item's end (or message start)
			// and this item's start — used for WTB/WTS detection
			const gapStart = i > 0 ? composedRanges[i - 1].end : 0;
			const prefixGap = preprocessedMessage.substring(
				gapStart,
				range.start,
			);

			const wtbGapMatches = [...prefixGap.matchAll(/WTB/gi)];
			const wtsGapMatches = [...prefixGap.matchAll(/WTS/gi)];
			const lastWtb =
				wtbGapMatches.length > 0
					? wtbGapMatches[wtbGapMatches.length - 1].index!
					: -1;
			const lastWts =
				wtsGapMatches.length > 0
					? wtsGapMatches[wtsGapMatches.length - 1].index!
					: -1;

			if (lastWtb > lastWts) {
				currentAuctionType = AuctionTypes.WTB;
			} else if (lastWts > lastWtb) {
				currentAuctionType = AuctionTypes.WTS;
			}

			// Price tail: text from this item's end to next item's start
			// (or end of message) — used for price parsing
			const tailEnd =
				i < composedRanges.length - 1
					? composedRanges[i + 1].start
					: preprocessedMessage.length;
			const priceTail = preprocessedMessage.substring(range.end, tailEnd);

			const { price, perItem } = this.parsePrice(priceTail);

			const theItem: ItemType = { item, price };
			if (perItem) theItem.perItem = true;

			if (currentAuctionType === AuctionTypes.WTS) {
				selling.push(theItem);
			} else {
				buying.push(theItem);
			}
		}

		return { buying, selling };
	}

	private parsePrice(text: string): {
		price: number | undefined;
		perItem: boolean;
	} {
		const PRICE_WITH_SUFFIX =
			/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|mil|pp?|plat(?:inum)?)\b/gi;
		const BARE_NUMBER = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\b/g;

		const suffixMatches = Array.from(text.matchAll(PRICE_WITH_SUFFIX));

		let match: RegExpExecArray | RegExpMatchArray | undefined;
		let suffix = '';

		if (suffixMatches.length > 0) {
			match = suffixMatches[suffixMatches.length - 1];
			suffix = match[2].toLowerCase();
		} else {
			const bareMatches = Array.from(text.matchAll(BARE_NUMBER));
			if (bareMatches.length > 0) {
				match = bareMatches[bareMatches.length - 1];
			}
		}

		if (!match) {
			return { price: undefined, perItem: false };
		}

		let price = parseFloat(match[1].replace(/,/g, ''));

		if (suffix === 'k') {
			price *= 1000;
		} else if (suffix === 'm' || suffix.startsWith('mil')) {
			price *= 1000000;
		}

		const afterPrice = text.substring(match.index! + match[0].length);
		const perItem = /^\s*\bea(?:ch)?\b/i.test(afterPrice);

		return { price, perItem };
	}
}

export function auctionIncludesUnknownItem(
	auctionText: string,
	item: string,
	watchType: AuctionTypes,
) {
	// Regular expressions for auction types
	const sellingRegex = /\b(WTS|SELLING|WTSELL)\b/i;
	const buyingRegex = /\b(WTB|BUYING|WTBUY)\b/i;

	const uppercaseAuctionText = auctionText.toUpperCase();

	// Find the index of the item in the auction text
	const itemIndex = uppercaseAuctionText.indexOf(item.toUpperCase());

	// If the item is not found, return false
	if (itemIndex === -1) return false;

	// Extract the text before the item
	const textBeforeItem = uppercaseAuctionText.substring(0, itemIndex);

	// Find the last occurrence of any auction type
	const lastSellingIndex = textBeforeItem.search(sellingRegex);
	const lastBuyingIndex = textBeforeItem.search(buyingRegex);

	// Determine the latest auction type declaration before the item
	const lastAuctionTypeIndex = Math.max(lastSellingIndex, lastBuyingIndex);

	// If no auction type declaration is found, assume selling
	if (lastAuctionTypeIndex === -1 && watchType === AuctionTypes.WTS) {
		return true;
	}

	// Check if the last auction type matches the type we are watching for
	if (watchType === AuctionTypes.WTS) {
		return lastSellingIndex >= lastBuyingIndex;
	} else {
		return lastBuyingIndex >= lastSellingIndex;
	}
}
