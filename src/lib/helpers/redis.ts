import { Interaction } from 'discord.js';
import { redis } from '../../redis/init';
import { gracefullyHandleError } from './errors';
import { client } from '../..';

export function generateButtonInteractionKey(interactionId: string) {
	return `buttonInteraction:${interactionId}`;
}

export function generatePlayerLinkKey(playerId: string) {
	return `playerLinkName:${playerId}`;
}

export async function getCachedPlayerDiscordName(playerId: string) {
	const key = generatePlayerLinkKey(playerId);

	let userName = await redis.get(key);
	if (!userName) {
		const user = await client.users.fetch(playerId);
		const set = await redis.set(key, user.username, 'EX', 7 * 24 * 60 * 60);
		if (set === 'OK') {
			userName = user.username;
		}
	}
	return userName;
}

// 	what a mess, discord sometimes fires the same button interaction multiple times
// 	I notice it seldomly but usually when moving focus while /watches are being
// 	deliverered and clicking very quickly once a message is delivered; it may be related
//  to clicking a button before the collector has registered the handler.  Let's
//  dedupe the button interactions by id...
export async function isDuplicateButtonInteraction(interaction: Interaction) {
	const key = generateButtonInteractionKey(interaction.id);

	const set = await redis.set(key, 'acknowledged', 'EX', 15, 'NX');
	if (!set) {
		const error = new Error(
			`duplicate discord button interaction received: ${interaction.id}`,
		);
		await gracefullyHandleError(error, interaction);
		const channelId = interaction.channelId;

		if (channelId) {
			const channel = await client.channels.fetch(channelId);
			if (channel && channel.isTextBased()) {
				// duplicate interaction - channel available for optional user feedback
			}
		}

		return true;
	}
	return false;
}
