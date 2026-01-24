import { Server } from '@prisma/client';
import { Tail } from 'tail';
import { redis } from '../../redis/init';
import { streamAuctionToAllStreamChannels } from '../streams/streamAuction';
import { triggerFoundWatchedItems } from '../watchNotification/watchNotification';
import {
	AuctionParser,
	AuctionTypes,
	auctionIncludesUnknownItem,
} from './parser';
import { state } from './state';
import path from 'path';
import { handleLinkMatch } from '../playerLink/playerLink';
import crypto from 'crypto';
import { gracefullyHandleError } from '../helpers/errors';

export function getLogFilePath(server: Server): string {
	let logFilePath: string | undefined;
	if ((process.env.FAKE_LOGS || 'false').match(/^[tT]/)) {
		logFilePath = path.join(__dirname, '..', 'fakeLogs', `${server}.log`);
	} else {
		const envVarName = `SERVERS_${server}_LOG_FILE_PATH`;
		logFilePath = process.env[envVarName] as string;
	}

	if (!logFilePath) {
		throw new Error(
			`Log file path for server ${server} is not defined in environment variables`,
		);
	}

	return logFilePath;
}

export function generateAuctionKey(auctionText: string) {
	const hash = crypto
		.createHash('sha256')
		.update(auctionText.toUpperCase())
		.digest('hex');
	const prefix = 'auctionLog:';
	return prefix + hash;
}

const parser = new AuctionParser();

export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);

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
			debug_console(`Auction Match: ${auctionMatch}`);
			// extract the timestamp, player, and auction message from the log line
			const [, playerName, auctionText] = auctionMatch;
			const auctionLogKey = generateAuctionKey(auctionText.toUpperCase());
			const cachedAuctionData = await redis.get(auctionLogKey);
			let auctionData;

			if (!cachedAuctionData) {
				// Parse the auction message if not in cache
				auctionData = parser.parseAuctionMessage(
					auctionText.toUpperCase(),
				);
				// Cache the parsed data
				await redis.set(auctionLogKey, JSON.stringify(auctionData));
			} else {
				// Use the cached data
				auctionData = JSON.parse(cachedAuctionData);
			}

			if (!auctionData) {
				throw new Error(
					'Could not retrieve auction data from redis or parse auction message',
				);
			}

			await streamAuctionToAllStreamChannels(
				playerName,
				server,
				auctionText,
				auctionData,
			);

			for (const item of auctionData.selling) {
				// 	"known" items are exact matches and can be looked up by key
				if (state.watchedItems[server].WTS.knownItems[item.item]) {
					await triggerFoundWatchedItems(
						state.watchedItems[server].WTS.knownItems[item.item],
						playerName,
						item.price,
						auctionText,
					);
				}
			}

			// Iterate over auctionData.buying array and check against watchedItems.WTB
			for (const item of auctionData.buying) {
				if (state.watchedItems[server].WTB.knownItems[item.item]) {
					await triggerFoundWatchedItems(
						state.watchedItems[server].WTB.knownItems[item.item],
						playerName,
						item.price,
						auctionText,
					);
				}
			}

			// while known items must be exact matches, unknown items should trigger a watch notification
			// if they appear anywhere in the auction message.  Since parsing price on unknown items is
			// unreliable, we will just pass undefined as the price.  Users are informed of this in the
			// response to /watch

			// check WTS watches for unknown items
			for (const unknownItem of state.watchedItems[server].WTS
				.unknownItems) {
				if (
					auctionIncludesUnknownItem(
						auctionText,
						unknownItem.item,
						AuctionTypes.WTS,
					)
				) {
					await triggerFoundWatchedItems(
						unknownItem.watchIds,
						playerName,
						undefined,
						auctionText,
					);
				}
			}

			// check WTB watches for unknown items
			for (const unknownItem of state.watchedItems[server].WTB
				.unknownItems) {
				if (
					auctionIncludesUnknownItem(
						auctionText,
						unknownItem.item,
						AuctionTypes.WTB,
					)
				) {
					await triggerFoundWatchedItems(
						unknownItem.watchIds,
						playerName,
						undefined,
						auctionText,
					);
				}
			}
		} else if (linkMatch) {
			debug_console(`Link Match: ${linkMatch}`);
			const [, playerName, linkCode] = linkMatch;
			// console.log(playerName, linkMatch);

			await handleLinkMatch(playerName, server, linkCode);
		}
	});

	tail.on('error', async function (error) {
		await gracefullyHandleError(error);
	});
}
