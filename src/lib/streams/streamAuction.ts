import { TextChannel, ChannelType } from 'discord.js';
import { client } from '../..';
import { Server } from '@prisma/client';
import { embeddedAuctionStreamMessageBuilder } from '../content/messages/messageBuilder';
import { gracefullyHandleError } from '../helpers/errors';

export function getEnvironmentVariable(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Environment variable ${name} is not defined.`);
	}
	return value;
}

export type AuctionData = {
	buying: ItemType[];
	selling: ItemType[];
};

export type ItemType = {
	item: string;
	price?: number | undefined;
};

export async function streamAuctionToAllStreamChannels(
	player: string,
	server: Server,
	auctionText: string,
	auctionData: AuctionData,
): Promise<void> {
	const classicEnvVarName = `SERVERS_${server.toUpperCase()}_STREAM_CHANNEL_CLASSIC_ID`;
	const embeddedEnvVarName = `SERVERS_${server.toUpperCase()}_STREAM_CHANNEL_EMBEDDED_ID`;

	const classicChannelId = getEnvironmentVariable(classicEnvVarName);
	const embeddedChannelId = getEnvironmentVariable(embeddedEnvVarName);

	const rawAuction = `\`\`\`\n${player} auctions, '${auctionText}'\`\`\``;

	try {
		const embeddedChannel = client.channels.cache.get(embeddedChannelId);
		if (
			!embeddedChannel ||
			embeddedChannel.type !== ChannelType.GuildText
		) {
			throw Error(
				`could not fetch classic stream channel ${classicChannelId}`,
			);
		}

		const embeds = await embeddedAuctionStreamMessageBuilder(
			player,
			server,
			auctionText,
			auctionData,
		);

		await (embeddedChannel as TextChannel).send({
			embeds: embeds,
			allowedMentions: { users: [] },
		});
	} catch (err) {
		// eslint-disable-next-line no-console
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
		// eslint-disable-next-line no-console
		await gracefullyHandleError(err);
	}
}
