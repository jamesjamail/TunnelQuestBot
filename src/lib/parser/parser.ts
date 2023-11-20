import { Trie } from './trieSearch';
import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';
import { ItemType } from '../streams/streamAuction';

// Oldschool JS lib works the best of all the options :(
const AhoCorasick = require("ahocorasick");


enum AuctionTypes {
	'WTS',
	'WTB',
}

export class AuctionParser {
	private itemTrie: Trie;
	private aho;

	constructor() {
		// Using custom Trie implementation
		this.itemTrie = new Trie();
		for (const itemName of Object.keys(consolidatedItemsAndAliases)) {
			this.itemTrie.insert(itemName);
		}
		// Using AC (also Trie based)
		this.aho = new AhoCorasick(
			Object.keys(consolidatedItemsAndAliases)
		);
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

	private wordIsAuctionType(word: string) {
		const wtsAuctionTypes = ['WTS', 'SELLING'];
		const wtbAuctionTypes = ['WTB', 'BUYING'];

		// Check if the word includes any of the WTS auction types
		for (const auctionType of wtsAuctionTypes) {
			if (word.includes(auctionType)) {
				return AuctionTypes.WTS;
			}
		}

		// Check if the word includes any of the WTB auction types
		for (const auctionType of wtbAuctionTypes) {
			if (word.includes(auctionType)) {
				return AuctionTypes.WTB;
			}
		}

		return false;
	}

	private parsePrice(
		words: string[],
		startIndex: number,
	): { price: number | undefined; newIndex: number } {
		// Find the end index of the price string
		let endIndex = startIndex;
		while (
			endIndex < words.length &&
			!/^[a-zA-Z]+$/.test(words[endIndex])
		) {
			endIndex++;
		}

		// Create the substring for the price
		const priceSubstring = words.slice(startIndex, endIndex).join(' ');

		// Split the substring into number groups (potentially with 'k' or 'kpp')
		const priceGroups = priceSubstring.match(/\d+(\.\d+)?k?(pp)?/gi);
		if (!priceGroups || priceGroups.length === 0) {
			return { price: undefined, newIndex: endIndex };
		}

		const firstGroup = priceGroups[0];
		const firstGroupIndex = priceSubstring.indexOf(firstGroup);

		// Check if the first group is the start of a known item
		if (this.itemTrie.search(firstGroup)) {
			// Known item, no price to extract
			return {
				price: undefined,
				newIndex: startIndex + firstGroupIndex,
			};
		}

		// Extract numerical value from the first group
		let price = parseFloat(firstGroup.replace(/[^0-9.]/g, ''));

		// Check for 'k' or 'kpp' in the first group
		if (/k(pp)?$/i.test(firstGroup)) {
			price *= 1000; // Multiply by 1000 if 'k' or 'kpp' is found
		}

		return { price, newIndex: endIndex };
	}

	// Thanks rici from StackOverflow for saving me time!
	// Based on https://stackoverflow.com/a/30472781
	private composeRanges(ranges: {start: number, end: number}[]) {
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
		const combined: {start: number, end: number}[] = [];
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

	public parseAuctionMessage(message: string): {
		buying: ItemType[];
		selling: ItemType[];
	} {
		const buying: ItemType[] = [];
		const selling: ItemType[] = [];

		const preprocessedMessage = this.preprocessMessage(message);
		const results = this.aho.search(preprocessedMessage);
		const match_ranges: {start: number, end: number}[] = [];
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
		const matches: {item: string, segment: string, price: number|undefined}[] = [];
		let last_range = {start: 0, end: 0};
		for (const range of composed_ranges) {
			if (last_range.end === 0) {
				last_range = range;
				continue;
			}
			matches.push({
				item: preprocessedMessage.substring(last_range.start, last_range.end),
				segment: preprocessedMessage.substring(last_range.start, range.start),
				price: undefined
			})
			last_range = range;
		}
		matches.push({
			item: preprocessedMessage.substring(last_range.start, last_range.end),
			segment: preprocessedMessage.substring(last_range.start),
			price: undefined
		})

		// Default to WTS or whichever is earlier in the message
		let currentAuctionType = AuctionTypes.WTS;
		const wtb_match = preprocessedMessage.match(/WTB/);
		const wts_match = preprocessedMessage.match(/WTS/);
		if (wtb_match && wts_match) {
			// @ts-ignore: if both ANDs pass, then both are defined
			if (wtb_match.index < wts_match.index) {
				currentAuctionType = AuctionTypes.WTB
			}
		} else if (wtb_match) {
			currentAuctionType = AuctionTypes.WTB
		}

		// Go through each segment and categorize it as WTB/WTS, and add price data
		for (const segment of matches) {
			if (segment.segment.match(/WTS/)) {
				currentAuctionType = AuctionTypes.WTS
			} else if (segment.segment.match(/WTB/)) {
				currentAuctionType = AuctionTypes.WTB
			}

			// Figure out price
			const price_match = Array.from(segment.segment.matchAll(/(?<price>[0-9]+(\.[0-9]+)?)(?<kpp>k?p{0,2})/gi));
			if (price_match.length > 0) {
				const single_price_match = price_match[price_match.length - 1];
				let price: number = +single_price_match[1];
				if (single_price_match[3] && single_price_match[3].match(/k/i)) {
					price *= 1000;
				}
				segment.price = price;
			}

			// Put it in the right bucket
			const the_item: ItemType = {item: segment.item, price: segment.price};
			if (currentAuctionType == AuctionTypes.WTS) {
				selling.push(the_item);
			} else {
				buying.push(the_item);
			}
		}

		return { buying, selling };
	}

	public parseAuctionMessage_orig(message: string): {
		buying: ItemType[];
		selling: ItemType[];
	} {
		const buying: ItemType[] = [];
		const selling: ItemType[] = [];
		let index = 0;
		const preprocessedMessage = this.preprocessMessage(message);
		const words = preprocessedMessage.split(' ');
		let currentAuctionType = AuctionTypes.WTS;
		let unknownItemString = '';

		function addUnknownItemToResultsAndReset() {
			// Check if unknownItemString contains more than 2 alphabetical characters excluding 'PP' or 'KPP'
			if (
				!/[a-zA-Z]{3,}/.test(
					unknownItemString.replace(/\bPP\b|\bKPP\b/g, ''),
				)
			) {
				// If not, reset unknownItemString and return early
				unknownItemString = '';
				return;
			}

			// if there is actualy content to parse, split the unknownItemString by delimiters
			const sections = unknownItemString.split(/[,./|\-_+~<>]/);
			sections.forEach((section) => {
				// Trim any whitespace from the section
				const trimmedSection = section.trim();
				if (!trimmedSection) return;

				// Attempt to parse the price from the last word in the section
				const words = trimmedSection.split(/\s+/);
				const lastWord = words[words.length - 1];
				let price = undefined;
				let item = trimmedSection;

				// Check if last word is a number possibly followed by k or kpp
				if (/^\d+(\.\d+)?k?(pp)?$/.test(lastWord)) {
					price = parseFloat(lastWord.replace(/[^0-9.]/g, ''));
					if (/k(pp)?$/.test(lastWord)) {
						price *= 1000;
					}
					// Remove the price part from the item string
					item = words.slice(0, -1).join(' ');
				}

				// Add to buying or selling array
				if (currentAuctionType === AuctionTypes.WTS) {
					selling.push({ item, price });
				} else {
					buying.push({ item, price });
				}
			});

			// Reset unknownItemString
			unknownItemString = '';
		}

		while (index < words.length) {
			const newAuctionType = this.wordIsAuctionType(words[index]);
			//  if the word is an auction type (WTS/WTB)
			// 	be explicit in this conditional - 'WTS' enum is 0!
			if (newAuctionType !== false) {
				//  TODO: parse price from unknownItemString
				// 	TODO: attempt to split unknownItemString by delimiters and/or numbers to separate multiple items
				addUnknownItemToResultsAndReset();
				//  update the auction type based on the current word
				currentAuctionType = newAuctionType;
				index++;
			} else {
				//  if the word is not an auction type, try it against the search trie
				//  find all the potential items that start with the current word
				// 	compare those against the following words
				const remainingWords = words.slice(index);
				const matchInfo =
					this.itemTrie.findMatchStartingWithFirstWord(
						remainingWords,
					);

				if (matchInfo) {
					//	found match, let's prepare it for results arrays
					const item: ItemType = { item: matchInfo.match };

					// Parse price after the end of the matched item
					const priceInfo = this.parsePrice(
						words,
						index + matchInfo.endIndex + 1,
					);
					item.price = priceInfo.price; // Add price to the item

					// Found a match, add to the appropriate list
					if (currentAuctionType === AuctionTypes.WTS) {
						selling.push(item);
					} else {
						buying.push(item);
					}

					addUnknownItemToResultsAndReset();
					// Advance index past the matched item
					index = priceInfo.newIndex;
				} else {
					// No match found starting with this word
					// add it to unkown item string
					unknownItemString += ' ' + words[index];
					// move to next word
					index++;
				}
			}
		}

		addUnknownItemToResultsAndReset();

		return { buying, selling };
	}
}
