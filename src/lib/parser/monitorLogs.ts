import type { Server } from '../../prisma/client';
import { config, serverEnvKeys } from '../../config';
import { Tail } from 'tail';
import { redis } from '../../redis/init';
import { streamAuctionToAllStreamChannels } from '../streams/streamAuction';
import { triggerFoundWatchedItems } from '../watchNotification/watchNotification';
import {
	AuctionParser,
	AuctionTypes,
	auctionIncludesUnknownItem,
} from './parser';
import type { AuctionData } from '../streams/streamAuction';
import { state } from './state';
import path from 'path';
import { handleLinkMatch } from '../playerLink/playerLink';
import crypto from 'crypto';
import { gracefullyHandleError } from '../helpers/errors';
import { resolveCanonicalItemName } from '../gameData/consolidatedItems';
import { debug } from '../helpers/logger';

export function getLogFilePath(server: Server): string {
	let logFilePath: string | undefined;
	if (config().FAKE_LOGS) {
		logFilePath = path.join(__dirname, '..', 'fakeLogs', `${server}.log`);
	} else {
		logFilePath = config()[serverEnvKeys(server).logFile] as
			| string
			| undefined;
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

export type ParsedLogLine =
	| { kind: 'auction'; playerName: string; text: string }
	| { kind: 'link'; playerName: string; linkCode: string };

type P99LoggerRecord = {
	type?: unknown;
	channel_name?: unknown;
	sender?: unknown;
	text?: unknown;
};

const UUID_PATTERN =
	/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/
		.source;
const LINK_CODE = new RegExp(`^Link me: (${UUID_PATTERN})$`);
const TEXT_LINK = new RegExp(
	`(\\w+) says? out of character, 'Link me: (${UUID_PATTERN})'`,
);

/** Read an auction or player-link request from either supported log format. */
export function parseLogLine(data: string): ParsedLogLine | undefined {
	if (data.trimStart().startsWith('{')) {
		let record: P99LoggerRecord;
		try {
			record = JSON.parse(data) as P99LoggerRecord;
		} catch {
			return undefined;
		}

		if (
			record.type !== 'chat' ||
			typeof record.sender !== 'string' ||
			record.sender.length === 0 ||
			typeof record.text !== 'string'
		) {
			return undefined;
		}

		if (record.channel_name === 'auction') {
			return {
				kind: 'auction',
				playerName: record.sender,
				text: record.text,
			};
		}

		if (record.channel_name === 'ooc') {
			const match = record.text.match(LINK_CODE);
			if (match) {
				return {
					kind: 'link',
					playerName: record.sender,
					linkCode: match[1],
				};
			}
		}

		return undefined;
	}

	const auctionMatch = data.match(/(\w+) auctions?, '(.+)'/);
	if (auctionMatch) {
		return {
			kind: 'auction',
			playerName: auctionMatch[1],
			text: auctionMatch[2],
		};
	}

	const linkMatch = data.match(TEXT_LINK);
	if (linkMatch) {
		return {
			kind: 'link',
			playerName: linkMatch[1],
			linkCode: linkMatch[2],
		};
	}

	return undefined;
}

export async function handleLogLine(server: Server, data: string) {
	const parsed = parseLogLine(data);

	if (parsed?.kind === 'auction') {
		const { playerName, text: auctionText } = parsed;
		debug(`Auction Match: ${playerName}: ${auctionText}`);
		const auctionLogKey = generateAuctionKey(auctionText.toUpperCase());
		const cachedAuctionData = await redis.get(auctionLogKey);
		let auctionData: AuctionData;

		if (!cachedAuctionData) {
			// Parse the auction message if not in cache
			auctionData = parser.parseAuctionMessage(auctionText.toUpperCase());
			// Cache the parsed data
			await redis.set(
				auctionLogKey,
				JSON.stringify(auctionData),
				'EX',
				60 * 60 * 24,
			);
		} else {
			// Use the cached data
			auctionData = JSON.parse(cachedAuctionData) as AuctionData;
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
			const canonicalName = resolveCanonicalItemName(item.item);
			if (state.watchedItems[server].WTS.knownItems[canonicalName]) {
				await triggerFoundWatchedItems(
					state.watchedItems[server].WTS.knownItems[canonicalName],
					playerName,
					item.price,
					auctionText,
				);
			}
		}

		// Iterate over auctionData.buying array and check against watchedItems.WTB
		for (const item of auctionData.buying) {
			const canonicalName = resolveCanonicalItemName(item.item);
			if (state.watchedItems[server].WTB.knownItems[canonicalName]) {
				await triggerFoundWatchedItems(
					state.watchedItems[server].WTB.knownItems[canonicalName],
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
		for (const unknownItem of state.watchedItems[server].WTS.unknownItems) {
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
		for (const unknownItem of state.watchedItems[server].WTB.unknownItems) {
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
	} else if (parsed?.kind === 'link') {
		debug(`Link Match: ${parsed.playerName}: ${parsed.linkCode}`);
		await handleLinkMatch(parsed.playerName, server, parsed.linkCode);
	}
}

export function monitorLogFile(server: Server) {
	const logFilePath = getLogFilePath(server);

	console.log(`Starting log monitoring for server ${server}: ${logFilePath}`);
	const tail = new Tail(logFilePath, {
		follow: true,
		flushAtEOF: true,
		useWatchFile: true,
	});

	tail.on('line', async (data) => {
		try {
			await handleLogLine(server, data);
		} catch (error) {
			// 	an EventEmitter discards the promise this listener returns, so
			// 	without catching here a single bad line ends the process and
			// 	stops log monitoring for every server
			await gracefullyHandleError(error, undefined, undefined, {
				server,
				line: data,
			});
		}
	});

	tail.on('error', async (error) => {
		await gracefullyHandleError(error);
	});
}
