import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';
import { ItemType } from '../streams/streamAuction';

// Oldschool JS lib works the best of all the options :(
// eslint-disable-next-line @typescript-eslint/no-var-requires -- Need JS lib
const AhoCorasick = require('ahocorasick');

enum AuctionTypes {
	'WTS',
	'WTB',
}

export class AuctionParser {
	private aho;

	constructor() {
		this.aho = new AhoCorasick(Object.keys(consolidatedItemsAndAliases));
	}

	private preprocessMessage(msg: string): string {
		// Replace 'WTT' with 'WTS'
		let processedMsg = msg.replace(/\bWTT\b/gi, 'WTS');

		// Remove specific patterns and exclamation marks
		processedMsg = processedMsg
			.replace(
				/\/WTT\b|\b(ASKING|OBO|OFFERS|OR BEST OFFER|TRADE|OR TRADE|PST|EACH|EA)\b|!/gi,
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
		// eslint-disable-next-line no-constant-condition
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
		// Getting the composed set of ranges solves the "substring" (overlap) problem
		const composedRanges = this.composeRanges(matchRanges);

		// Pull together a list of matches with their corresponding "segments"
		// A "segment" is all text from the start of the match to just before the
		// start of the next match. This is useful for capturing price data.
		const matches: {
			item: string;
			segment: string;
			price: number | undefined;
		}[] = [];
		let lastRange = { start: 0, end: 0 };
		for (const range of composedRanges) {
			if (lastRange.end === 0) {
				lastRange = range;
				continue;
			}
			matches.push({
				item: preprocessedMessage.substring(
					lastRange.start,
					lastRange.end,
				),
				segment: preprocessedMessage.substring(
					lastRange.start,
					range.start,
				),
				price: undefined,
			});
			lastRange = range;
		}
		matches.push({
			item: preprocessedMessage.substring(lastRange.start, lastRange.end),
			segment: preprocessedMessage.substring(lastRange.start),
			price: undefined,
		});

		// Default to WTS or whichever is earlier in the message
		let currentAuctionType = AuctionTypes.WTS;
		const wtbMatch = preprocessedMessage.match(/WTB/);
		const wtsMatch = preprocessedMessage.match(/WTS/);
		if (wtbMatch && wtsMatch) {
			// Typescript barks wtbMatch and wtsMatch might be undefined, even though
			// they are tested above.  ! is used to assert non-nullness
			if (wtbMatch.index! < wtsMatch.index!) {
				currentAuctionType = AuctionTypes.WTB;
			}
		} else if (wtbMatch) {
			currentAuctionType = AuctionTypes.WTB;
		}

		// Go through each segment and categorize it as WTB/WTS, and add price data
		for (const segment of matches) {
			if (segment.segment.match(/WTS/)) {
				currentAuctionType = AuctionTypes.WTS;
			} else if (segment.segment.match(/WTB/)) {
				currentAuctionType = AuctionTypes.WTB;
			}

			// Figure out price
			const priceMatch = Array.from(
				segment.segment.matchAll(
					/(?<price>[0-9]+(\.[0-9]+)?)(?<kpp>k?p{0,2})/gi,
				),
			);
			if (priceMatch.length > 0) {
				const singlePriceMatch = priceMatch[priceMatch.length - 1];
				let price: number = +singlePriceMatch[1];
				if (singlePriceMatch[3] && singlePriceMatch[3].match(/k/i)) {
					price *= 1000;
				}
				segment.price = price;
			}

			// Put it in the right bucket
			const theItem: ItemType = {
				item: segment.item,
				price: segment.price,
			};
			if (currentAuctionType == AuctionTypes.WTS) {
				selling.push(theItem);
			} else {
				buying.push(theItem);
			}
		}

		return { buying, selling };
	}
}
