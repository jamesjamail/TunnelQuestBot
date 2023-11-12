import { Server } from '@prisma/client';
import { Tail } from 'tail';
import { getLogFilePath, handleLinkMatch } from './helpers';
import { Trie } from './trieSearch';
import inGameItemsObject from '../content/gameData/items.json';
import {
	ItemType,
	streamAuctionToAllStreamChannels,
} from '../content/streams/streamAuction';
import { state } from './state';
import { triggerFoundWatchedItems } from '../helpers/watchNotification';

export function isAuctionOfInterest(
	text: string,
	watchedItems: { [item: string]: number[] },
): boolean {
	return Object.keys(watchedItems).some((item) => text.includes(item));
}

enum AuctionTypes {
	'WTS',
	'WTB',
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
		// Replace 'WTT' with 'WTS'
		let processedMsg = msg.replace(/\bWTT\b/gi, 'WTS');

		// Remove specific patterns and exclamation marks
		processedMsg = processedMsg
			.replace(
				/\/WTT\b|\b(ASKING|OBO|OFFERS|OR BEST OFFER|PST)\b|!/gi,
				'',
			)
			.trim();

		return processedMsg;
	}

	private wordIsAuctionType(word: string) {
		const wtsAuctionTypes = ['WTS', 'SELLING'];
		const wtbAuctionTypes = ['WTB', 'BUYING'];
		if (wtsAuctionTypes.includes(word)) {
			return AuctionTypes.WTS;
		}

		if (wtbAuctionTypes.includes(word)) {
			return AuctionTypes.WTB;
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

	public parseAuctionMessage(message: string): {
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
					index += matchInfo.endIndex + 1;
				} else {
					// No match found starting with this word
					// add it to unkown item string
					unknownItemString += ' ' + words[index];
					// move to next word
					index++;
				}
			}
		}

		return { buying, selling };
	}
}

const parser = new AuctionParser();

export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);
	// eslint-disable-next-line no-console
	console.log(
		'Starting log monitoring for server ' + server + ': ' + logFilePath,
	);
	const tail = new Tail(logFilePath, {
		follow: true,
		flushAtEOF: true,
		useWatchFile: true,
	});
	const watchedItemsForThisServer = state.watchedItems[server];

	tail.on('line', async function (data) {
		// filter for log lines that start with "soAndSo auctions,"
		const auctionMatch = data.match(/(\w+) auctions?, '(.+)'/);
		const linkMatch = data.match(
			/(\w+) says? out of character, 'Link me: ([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12})'/,
		);

		if (auctionMatch) {
			// extract the timestamp, player, and auction message from the log line
			const [, playerName, auctionText] = auctionMatch;
			// console.log(playerName, auctionText);
			const auctionData = parser.parseAuctionMessage(
				auctionText.toUpperCase(),
			);

			// console.log('auctionData = ', auctionData);

			await streamAuctionToAllStreamChannels(
				playerName,
				server,
				auctionText,
				auctionData,
			);

			auctionData.selling.forEach(async (item) => {
				if (watchedItemsForThisServer.WTS[item.item]) {
					await triggerFoundWatchedItems(
						watchedItemsForThisServer.WTS[item.item],
						playerName,
						item.price,
						auctionText,
					);
				}
			});

			// Iterate over auctionData.buying array and check against watchedItems.WTB
			auctionData.buying.forEach(async (item) => {
				if (watchedItemsForThisServer.WTB[item.item]) {
					// TODO: if any of the watchedItems for this server and auctionType are not
					// known item names, check each auctionData to see if it includes the
					// watchedItem.  For example "banded armor" isn't a known item and should
					// trigger if an item "various banded armor pieces" is auctioned.  this involves
					// refactoring state into known items and unknown items
					await triggerFoundWatchedItems(
						watchedItemsForThisServer.WTB[item.item],
						playerName,
						item.price,
						auctionText,
					);
				}
			});
		} else if (linkMatch) {
			const [, playerName, linkCode] = linkMatch;
			// console.log(playerName, linkMatch);

			await handleLinkMatch(playerName, server, linkCode);
		}
	});

	tail.on('error', function (error) {
		// eslint-disable-next-line no-console
		console.error('LOG PARSER ERROR: ', error);
	});
}
