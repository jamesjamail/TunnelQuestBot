import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';
import type { AuctionData, ItemType } from '../streams/streamAuction';

// Oldschool JS lib works the best of all the options :(

const AhoCorasick = require('ahocorasick');

//	A const object rather than a TS `enum`: `enum` is one of the few TypeScript
//	constructs that emits runtime code, so it cannot be type-stripped. Keeping
//	the syntax erasable is what lets `node --watch src/index.ts` run the sources
//	directly with no build step. `erasableSyntaxOnly` in tsconfig enforces it.
export const AuctionTypes = {
	WTS: 'WTS',
	WTB: 'WTB',
} as const;

export type AuctionTypes = (typeof AuctionTypes)[keyof typeof AuctionTypes];

export type MatchRange = { start: number; end: number };

// Both parser entry points must agree on what declares a section, otherwise a
// known-item watch and an unknown-item watch classify the same line differently.
const SELLING_KEYWORDS = /\b(WTS|SELLING|WTSELL)\b/gi;
const BUYING_KEYWORDS = /\b(WTB|BUYING|WTBUY)\b/gi;

export function preprocessMessage(msg: string): string {
	// Replace 'WTT' (want to trade) with 'WTS' so it's treated as selling
	let processedMsg = msg.replace(/\bWTT\b/gi, 'WTS');

	// Remove noise patterns and exclamation marks that interfere with parsing.
	// Note: EA/EACH are intentionally preserved so we can detect per-item pricing.
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
export function composeRanges(ranges: MatchRange[]) {
	const starts = ranges.map((r) => r.start).sort((a, b) => a - b);
	const ends = ranges.map((r) => r.end).sort((a, b) => a - b);
	let i = 0,
		j = 0,
		active = 0;
	const n = ranges.length;
	const combined: MatchRange[] = [];

	while (true) {
		if (i < n && starts[i] < ends[j]) {
			if (active++ === 0) combined.push({ start: starts[i], end: -1 });
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

// Extract a price from the text that follows an item name (the "price tail").
// Prefers numbers with a recognized suffix (k, pp, plat, m, mil, etc.) to
// avoid false positives from quantity patterns like "x4" or "(x20)".
// Falls back to a bare number only if no suffixed match exists.
export function parsePrice(text: string): {
	price: number | undefined;
	perItem: boolean;
} {
	// Matches numbers with a price suffix: 3.5k, 500pp, 10,000plat, 1.5mil, etc.
	const PRICE_WITH_SUFFIX =
		/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|mil|pp?|plat(?:inum)?)\b/gi;
	// Fallback: bare numbers without a suffix (less reliable, used only if no suffix match)
	const BARE_NUMBER = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\b/g;

	// Prefer the last suffixed match (closest to the item, after any quantity indicators)
	const suffixMatches = Array.from(text.matchAll(PRICE_WITH_SUFFIX));

	let match: RegExpExecArray | RegExpMatchArray | undefined;
	let suffix = '';

	if (suffixMatches.length > 0) {
		match = suffixMatches[suffixMatches.length - 1];
		suffix = match[2].toLowerCase();
	} else {
		// No suffixed price found — fall back to the last bare number
		const bareMatches = Array.from(text.matchAll(BARE_NUMBER));
		if (bareMatches.length > 0) {
			match = bareMatches[bareMatches.length - 1];
		}
	}

	if (!match) {
		return { price: undefined, perItem: false };
	}

	// Strip commas and parse the numeric value
	let price = parseFloat(match[1].replace(/,/g, ''));

	// Apply multiplier based on suffix
	if (suffix === 'k') {
		price *= 1000;
	} else if (suffix === 'm' || suffix.startsWith('mil')) {
		price *= 1000000;
	}
	// p, pp, plat, platinum — already in platinum units, no multiplier needed

	// Check if "ea" or "each" follows the price, indicating a per-item price
	const afterPrice = text.substring(match.index! + match[0].length);
	const perItem = /^\s*\bea(?:ch)?\b/i.test(afterPrice);

	return { price, perItem };
}

export class AuctionParser {
	private aho;

	constructor(items?: string[]) {
		this.aho = new AhoCorasick(
			items ?? Object.keys(consolidatedItemsAndAliases),
		);
	}

	public parseAuctionMessage(message: string): AuctionData {
		const buying: ItemType[] = [];
		const selling: ItemType[] = [];

		const preprocessedMessage = preprocessMessage(message);

		// Use Aho-Corasick to find all known item name matches in the message
		const results = this.aho.search(preprocessedMessage);
		const matchRanges: MatchRange[] = [];
		for (const i in results) {
			const item = results[i];
			matchRanges.push({
				start: item[0] - item[1][0].length + 1,
				end: item[0] + 1,
			});
		}

		// Compose overlapping ranges to solve the substring/overlap problem
		// (e.g. "FLOWING BLACK SILK SASH" and "FBSS" overlapping with longer items)
		const composedRanges = composeRanges(matchRanges);

		// Default to WTS if no auction type keyword appears before the first item
		//	annotated because a const object infers the literal type, where the
		//	old numeric enum widened to the enum type on its own
		let currentAuctionType: AuctionTypes = AuctionTypes.WTS;

		// For each matched item, examine two text regions:
		//   "prefix gap" = text BEFORE the item (between prev item's end and this item's start)
		//                  -> used to detect WTB/WTS keywords that apply to this item
		//   "price tail"  = text AFTER the item (between this item's end and next item's start)
		//                  -> used to extract price and per-item indicators
		// This decoupling prevents a WTB/WTS keyword in the trailing text of item A
		// from being misattributed to item A (the old segment-based bug).
		for (let i = 0; i < composedRanges.length; i++) {
			const range = composedRanges[i];
			const item = preprocessedMessage
				.substring(range.start, range.end)
				.trim();
			if (item === '') continue;

			// Check the prefix gap for the last WTB/WTS keyword to determine auction type
			const gapStart = i > 0 ? composedRanges[i - 1].end : 0;
			const prefixGap = preprocessedMessage.substring(
				gapStart,
				range.start,
			);

			const wtbGapMatches = [...prefixGap.matchAll(BUYING_KEYWORDS)];
			const wtsGapMatches = [...prefixGap.matchAll(SELLING_KEYWORDS)];
			const lastWtb =
				wtbGapMatches.length > 0
					? wtbGapMatches[wtbGapMatches.length - 1].index!
					: -1;
			const lastWts =
				wtsGapMatches.length > 0
					? wtsGapMatches[wtsGapMatches.length - 1].index!
					: -1;

			// Whichever keyword appeared last in the gap wins
			if (lastWtb > lastWts) {
				currentAuctionType = AuctionTypes.WTB;
			} else if (lastWts > lastWtb) {
				currentAuctionType = AuctionTypes.WTS;
			}

			// Extract price from the tail text after this item
			const tailEnd =
				i < composedRanges.length - 1
					? composedRanges[i + 1].start
					: preprocessedMessage.length;
			const priceTail = preprocessedMessage.substring(range.end, tailEnd);

			const { price, perItem } = parsePrice(priceTail);

			// Put the item in the appropriate bucket
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
}

export function auctionIncludesUnknownItem(
	auctionText: string,
	item: string,
	watchType: AuctionTypes,
) {
	const uppercaseAuctionText = auctionText.toUpperCase();

	// Find the index of the item in the auction text
	const itemIndex = uppercaseAuctionText.indexOf(item.toUpperCase());

	// If the item is not found, return false
	if (itemIndex === -1) return false;

	// Extract the text before the item
	const textBeforeItem = uppercaseAuctionText.substring(0, itemIndex);

	// Find the LAST occurrence of each auction type keyword before the item
	const lastIndexOf = (regex: RegExp) => {
		let last = -1;
		for (const match of textBeforeItem.matchAll(regex)) {
			last = match.index ?? last;
		}
		return last;
	};
	const lastSellingIndex = lastIndexOf(SELLING_KEYWORDS);
	const lastBuyingIndex = lastIndexOf(BUYING_KEYWORDS);

	// No auction type declared before the item: auctions default to selling,
	// so only WTS watches may match
	if (lastSellingIndex === -1 && lastBuyingIndex === -1) {
		return watchType === AuctionTypes.WTS;
	}

	// The keyword closest to (before) the item decides its section
	if (watchType === AuctionTypes.WTS) {
		return lastSellingIndex >= lastBuyingIndex;
	} else {
		return lastBuyingIndex > lastSellingIndex;
	}
}
