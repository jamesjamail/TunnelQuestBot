import { Interaction } from 'discord.js';
import { redis } from '../../redis/init';
import { gracefullyHandleError } from './errors';
import { client } from '../..';

export function generateButtonInteractionKey(interactionId: string) {
	return `buttonInteraction:${interactionId}`;
}

// 	what a mess, discord sometimes fires the same button interaction multiple times
// 	I notice it seldomly but usually when moving focus while /watches are being
// 	deliverered and clicking very quickly once a message is delivered; it may be related
//  to clicking a button before the collector has registered the handler.  Let's
//  dedupe the button interactions by id...
export async function isDuplicateButtonInteraction(interaction: Interaction) {
	const key = generateButtonInteractionKey(interaction.id);

	// write if it doesnt already exist
	const set = await redis.setnx(key, 'acknowledged');
	if (!set) {
		const error = new Error(
			`duplicate discord button interaction received: ${interaction.id}`,
		);
		await gracefullyHandleError(error, interaction);
		// at this point, the interaction is completely borked - attempts to use it will fail
		// let's inform the user in a new message that something went wrong.
		// const errorText =
		// 	'Something went wrong.  Please re-enter the command and try the button interaction again.';

		// any attempt of interaction.update, interaction.user.send, etc. will fail.
		// if we've got the channel id, let's use that the fetch the channel
		const channelId = interaction.channelId;

		if (channelId) {
			const channel = await client.channels.fetch(channelId);
			if (channel && channel.isTextBased()) {
				// TODO: this can send several messages depending on how many errors throw
				// keep it a timed message to hide the evidence of the atrocity.
				// we may be able to use redis to avoid sending more than once
				// in my experience, on this bug starts to happen. even re-issuing
				// the command will continue to fire duplicate interaction ids and
				// general weirdness.  May we should throw so the app restarts?
				//
				// this is sending like crazy, maybe send once and then throw to restart
				// sendTimedMessage(errorText, channel as TextChannel, 10000);
			}
		}

		return true; // Skip processing if key exists
	}
	// Set a TTL for the key
	await redis.expire(key, 15);
	return false;
}
