import { TextChannel } from 'discord.js';
import { client } from '../..';

//	the cutoff the bulk delete endpoint enforces
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function removeNoncommandMessagesFromPublicCommandSpace() {
	try {
		// Get the channel by ID from environment variable
		const commandChannelId = process.env.COMMAND_CHANNEL;
		if (!commandChannelId) {
			throw new Error('Missing COMMAND_CHANNEL env.');
		}
		const commandChannel = await client.channels.fetch(commandChannelId);

		// Check if the channel exists and is a text channel
		if (!commandChannel || !(commandChannel instanceof TextChannel)) {
			throw new Error(
				'Command channel specified is invalid or not a text channel.',
			);
		}

		const textChannel = commandChannel as TextChannel;

		// Fetch messages
		const messages = await textChannel.messages.fetch();

		// Skip the first message (the command syntax instructions)
		const instructionsMessageId = messages.lastKey();
		const [recent, stale] = messages
			.filter((_, id) => id !== instructionsMessageId)
			.partition(
				(message) =>
					Date.now() - message.createdTimestamp <
					BULK_DELETE_MAX_AGE_MS,
			);

		// 	one request instead of one per message, which rate limits hard once a
		// 	backlog builds up. messages.fetch() returns 50 by default and the
		// 	endpoint accepts 100, so this always fits in a single call.
		await textChannel.bulkDelete(recent);

		// 	the bulk endpoint rejects these outright, so they still cost a request
		// 	each; awaited in turn so a backlog cannot recreate the fan-out above
		for (const message of stale.values()) {
			await message.delete();
		}
	} catch (error) {
		// Log and handle any errors

		console.error(
			'Error occurred while removing non-command messages from public command channel:',
			error,
		);
	}
}
