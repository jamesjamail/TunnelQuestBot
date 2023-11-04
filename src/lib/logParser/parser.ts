import { Server } from '@prisma/client';
import { Tail } from 'tail';
import { getLogFilePath, handleLinkMatch } from './helpers';
import { Trie } from './trieSearch';
import inGameItemsObject from '../content/gameData/items.json';
import {
	ItemType,
	streamAuctionToAllStreamChannels,
} from '../content/streams/streamAuction';

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
		// TODO: replace WTT with WTS as it's essentially the same thing
		return msg.replace(/PST[.,!]*\s*(to\s+\w+)?/gi, '').trim();
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
			// Extract only alphabetical characters from the unknownItemString
			const alphabeticalCharactersMatch =
				unknownItemString.match(/[a-zA-Z]+/g);
			const alphabeticalCharacters = alphabeticalCharactersMatch
				? alphabeticalCharactersMatch.join('')
				: '';

			//  unknown item names that have less than 3 alphabetical are not likely items
			if (alphabeticalCharacters.length > 2) {
				if (currentAuctionType === AuctionTypes.WTS) {
					selling.push({ item: unknownItemString });
				} else {
					buying.push({ item: unknownItemString });
				}
			}

			// Reset unknown item string after adding item to resulting buying or selling array
			unknownItemString = '';
		}

		while (index < words.length) {
			const newAuctionType = this.wordIsAuctionType(words[index]);
			//  if the word is an auction type (WTS/WTB)
			// 	be explicit - 'WTS' enum is 0!
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
					// Found a match, add to the appropriate list
					// TODO: parse price
					// 		create a substring from the first char after the known item to the next letter
					//  	filter our numbers, keep track of if they include k or kpp after them
					// 		parse the value based on the unit
					const item: ItemType = { item: matchInfo.match };
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
