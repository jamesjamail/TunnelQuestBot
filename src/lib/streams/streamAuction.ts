import { type TextChannel, ChannelType } from 'discord.js';
import { client } from '../..';
import type { Server } from '../../prisma/client';
import {
	embeddedAuctionStreamMessageBuilder,
	packEmbedsForDiscord,
} from '../content/messages/messageBuilder';
import { serverEnvKeys } from '../../config';
import { gracefullyHandleError } from '../helpers/errors';
import { getEnvironmentVariable } from '../helpers/env';

export type AuctionData = {
	buying: ItemType[];
	selling: ItemType[];
};

export type ItemType = {
	item: string;
	price?: number | undefined;
	perItem?: boolean;
};

export async function streamAuctionToAllStreamChannels(
	player: string,
	server: Server,
	auctionText: string,
	auctionData: AuctionData,
): Promise<void> {
	const keys = serverEnvKeys(server);

	const classicChannelId = getEnvironmentVariable(keys.classicChannel);
	const embeddedChannelId = getEnvironmentVariable(keys.embeddedChannel);

	const rawAuction = `\`\`\`\n${player} auctions, '${auctionText}'\`\`\``;

	try {
		const embeddedChannel = client.channels.cache.get(embeddedChannelId);
		if (
			!embeddedChannel ||
			embeddedChannel.type !== ChannelType.GuildText
		) {
			throw Error(
				`could not fetch embedded stream channel ${embeddedChannelId}`,
			);
		}

		const embeds = await embeddedAuctionStreamMessageBuilder(
			player,
			server,
			auctionText,
			auctionData,
		);

		for (const batch of packEmbedsForDiscord(embeds)) {
			await (embeddedChannel as TextChannel).send({
				embeds: batch,
				allowedMentions: { users: [] },
			});
		}
	} catch (err) {
		await gracefullyHandleError(err);
	}

	try {
		const classicChannel = client.channels.cache.get(classicChannelId);
		if (!classicChannel || classicChannel.type !== ChannelType.GuildText) {
			throw Error(
				`could not fetch classic stream channel ${classicChannelId}`,
			);
		}
		await (classicChannel as TextChannel).send(rawAuction);
	} catch (err) {
		await gracefullyHandleError(err);
	}
}
