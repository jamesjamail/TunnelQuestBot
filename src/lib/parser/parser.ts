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
		const match_ranges: { start: number; end: number }[] = [];
		for (const i in results) {
			const item = results[i];
			match_ranges.push({
				start: item[0] - item[1][0].length + 1,
				end: item[0] + 1,
			});
		}
		// Getting the composed set of ranges solves the "substring" (overlap) problem
		const composed_ranges = this.composeRanges(match_ranges);

		// Pull together a list of matches with their corresponding "segments"
		// A "segment" is all text from the start of the match to just before the
		// start of the next match. This is useful for capturing price data.
		const matches: {
			item: string;
			segment: string;
			price: number | undefined;
		}[] = [];
		let last_range = { start: 0, end: 0 };
		for (const range of composed_ranges) {
			if (last_range.end === 0) {
				last_range = range;
				continue;
			}
			matches.push({
				item: preprocessedMessage.substring(
					last_range.start,
					last_range.end,
				),
				segment: preprocessedMessage.substring(
					last_range.start,
					range.start,
				),
				price: undefined,
			});
			last_range = range;
		}
		matches.push({
			item: preprocessedMessage.substring(
				last_range.start,
				last_range.end,
			),
			segment: preprocessedMessage.substring(last_range.start),
			price: undefined,
		});

		// Default to WTS or whichever is earlier in the message
		let currentAuctionType = AuctionTypes.WTS;
		const wtb_match = preprocessedMessage.match(/WTB/);
		const wts_match = preprocessedMessage.match(/WTS/);
		if (wtb_match && wts_match) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- linter is wrong here
			// @ts-ignore -- if both ANDs pass, then both are defined
			if (wtb_match.index < wts_match.index) {
				currentAuctionType = AuctionTypes.WTB;
			}
		} else if (wtb_match) {
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
			const price_match = Array.from(
				segment.segment.matchAll(
					/(?<price>[0-9]+(\.[0-9]+)?)(?<kpp>k?p{0,2})/gi,
				),
			);
			if (price_match.length > 0) {
				const single_price_match = price_match[price_match.length - 1];
				let price: number = +single_price_match[1];
				if (
					single_price_match[3] &&
					single_price_match[3].match(/k/i)
				) {
					price *= 1000;
				}
				segment.price = price;
			}

			// Put it in the right bucket
			const the_item: ItemType = {
				item: segment.item,
				price: segment.price,
			};
			if (currentAuctionType == AuctionTypes.WTS) {
				selling.push(the_item);
			} else {
				buying.push(the_item);
			}
		}

		return { buying, selling };
	}
}
