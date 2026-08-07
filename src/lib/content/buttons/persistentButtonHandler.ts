import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { type PlayerLink, Server } from '../../../prisma/client';
import { parseCustomId, ButtonInteractionTypes } from './buttonBuilder';
import * as handlers from './buttonInteractionHandlers/index';
import {
	getWatchByWatchId,
	getWatchByWatchIdForWatchNotification,
} from '../../../prisma/dbExecutors/watch';
import { prisma } from '../../../prisma/init';
import type { WatchNotificationMetadata } from '../../watchNotification/watchNotification';

// Extract notification context (player, price, auctionMessage) from an
// existing watch notification embed so we can reconstruct metadata after
// a bot restart when in-memory state is gone.
export function extractNotificationContext(interaction: ButtonInteraction): {
	player: string;
	price: number | undefined;
	auctionMessage: string;
} {
	const embed = interaction.message?.embeds?.[0];
	const description = embed?.description ?? '';

	const playerMatch = description.match(/\*\*(\w+)\*\*/);
	const player = playerMatch?.[1] ?? 'Unknown';

	const auctionMatch = description.match(/``\w+ auctions, (.+?)``/s);
	const auctionMessage = auctionMatch?.[1] ?? '';

	let price: number | undefined;
	const priceMatch = description.match(/for \*\*(.+?)\*\*/);
	if (priceMatch) {
		const cleaned = priceMatch[1].replace(/,/g, '');
		const valueMatch = cleaned.match(/([0-9.]+)\s*(k|m)?/i);
		if (valueMatch) {
			let parsed = parseFloat(valueMatch[1]);
			const suffix = valueMatch[2]?.toLowerCase();
			if (suffix === 'k') parsed *= 1000;
			if (suffix === 'm') parsed *= 1000000;
			price = parsed || undefined;
		}
	}

	return { player, price, auctionMessage };
}

// Reconstruct a PlayerLink from the embed title when the link was deleted
// from the DB (e.g. user clicked Unlink, then Relink after a bot restart).
// Embed title format: "Player (SERVER)" or "⛓️‍💥 Player (SERVER)"
function reconstructPlayerLinkFromEmbed(
	interaction: ButtonInteraction,
	id: number,
): PlayerLink | null {
	const title = interaction.message?.embeds?.[0]?.title ?? '';
	const match = title.match(/([A-Za-z]+)\s*\((\w+)\)/);
	if (!match) return null;
	const [, player, server] = match;
	if (!Object.values(Server).includes(server as Server)) return null;
	return {
		id,
		discordUserId: interaction.user.id,
		server: server as Server,
		player,
		linkCode: null,
		linkCodeExpiry: null,
	};
}

type HandlerFn = (
	interaction: ButtonInteraction,
	metadata: unknown,
) => Promise<void>;

// Same mapping as the old collector, keyed by the action type string
const handlerMapping: Record<string, HandlerFn> = {
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchSnoozeInactive]]:
		handlers.handleWatchSnoozeInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchSnoozeActive]]:
		handlers.handleWatchSnoozeActive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UnwatchInactive]]:
		handlers.handleUnwatchInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UnwatchActive]]:
		handlers.handleUnwatchActive,
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchRefreshInactive]]:
		handlers.handleWatchRefreshInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchRefreshActive]]:
		handlers.handleWatchRefreshInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.GlobalRefreshInactive]]:
		handlers.handleGlobalRefreshInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.GlobalRefreshActive]]:
		handlers.handleGlobalRefreshInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UserSnoozeInactive]]:
		handlers.handleUserSnoozeInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UserSnoozeActive]]:
		handlers.handleUserSnoozeActive,
	[ButtonInteractionTypes[ButtonInteractionTypes.GlobalUnblockInactive]]:
		handlers.handleGlobalUnblockInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.GlobalUnblockActive]]:
		handlers.handleGlobalUnblockActive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UnlinkCharacterInactive]]:
		handlers.handleUnlinkCharacterInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.UnlinkCharacterActive]]:
		handlers.handleUnlinkCharacterActive,
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchBlockInactive]]:
		handlers.handleWatchBlockInactive,
	[ButtonInteractionTypes[ButtonInteractionTypes.WatchBlockActive]]:
		handlers.handleWatchBlockActive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationSnoozeInactive
	]]: handlers.handleWatchNotificationSnoozeInactive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationSnoozeActive
	]]: handlers.handleWatchNotificationSnoozeActive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationUnwatchInactive
	]]: handlers.handleWatchNotificationUnwatchInactive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationUnwatchActive
	]]: handlers.handleWatchNotificationUnwatchActive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationWatchRefreshInactive
	]]: handlers.handleWatchNotificationRefreshInactive,
	[ButtonInteractionTypes[
		ButtonInteractionTypes.WatchNotificationWatchRefreshActive
	]]: handlers.handleWatchNotificationRefreshInactive,
};

async function fetchMetadata(
	interaction: ButtonInteraction,
	actionType: string,
	entityId?: string,
	extra?: string,
): Promise<unknown> {
	const id = entityId ? parseInt(entityId, 10) : undefined;

	if (
		actionType.startsWith('WatchSnooze') ||
		actionType.startsWith('Unwatch') ||
		actionType.startsWith('WatchRefresh')
	) {
		if (!id) return undefined;
		return getWatchByWatchId(id);
	}

	if (
		actionType.startsWith('UserSnooze') ||
		actionType.startsWith('GlobalRefresh')
	) {
		return undefined;
	}

	if (actionType.startsWith('GlobalUnblock')) {
		if (!id) return undefined;
		return { id } as { id: number };
	}

	if (actionType.startsWith('UnlinkCharacter')) {
		if (!id) return undefined;
		const link = await prisma.playerLink.findUnique({ where: { id } });
		if (link) return link;
		// Link was deleted — reconstruct from the embed title ("Player (SERVER)"
		// or "⛓️‍💥 Player (SERVER)") so the Relink handler can re-insert it.
		return reconstructPlayerLinkFromEmbed(interaction, id);
	}

	// WatchNotification and WatchBlock buttons encode watchId:playerName.
	// Use getWatchByWatchIdForWatchNotification to include the user and
	// blockedWatches relations that the WatchBlock handlers require.
	if (
		actionType.startsWith('WatchNotification') ||
		actionType.startsWith('WatchBlock')
	) {
		if (!id) return undefined;
		const watch = await getWatchByWatchIdForWatchNotification(id);
		if (!watch) return undefined;
		const player = extra ?? extractNotificationContext(interaction).player;
		const { price, auctionMessage } =
			extractNotificationContext(interaction);
		return {
			...watch,
			player,
			price,
			auctionMessage,
		} as WatchNotificationMetadata;
	}

	return undefined;
}

const ENTITY_FREE_PREFIXES = ['UserSnooze', 'GlobalRefresh', 'GlobalUnblock'];

export async function handleButtonInteraction(
	interaction: ButtonInteraction,
): Promise<void> {
	const { actionType, entityId, extra } = parseCustomId(interaction.customId);

	const handler = handlerMapping[actionType];
	if (!handler) return;

	let metadata: unknown;
	try {
		metadata = await fetchMetadata(
			interaction,
			actionType,
			entityId,
			extra,
		);
	} catch {
		metadata = null;
	}

	const needsEntity = !ENTITY_FREE_PREFIXES.some((p) =>
		actionType.startsWith(p),
	);
	if (needsEntity && metadata == null) {
		await interaction.reply({
			content:
				'This item no longer exists. It may have been deleted or expired.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await handler(interaction, metadata);
}
