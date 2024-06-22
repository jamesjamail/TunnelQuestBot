import { TextChannel } from 'discord.js';
import { client } from '../..';

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

		// Create an array of promises for deleting messages
		const deletePromises = messages.map(async (message, key) => {
			// Skip the first message (the command syntax instructions)
			if (key === messages.lastKey()) return;
			// delete all others
			await message.delete();
		});

		// Wait for all delete operations to complete
		await Promise.all(deletePromises);
	} catch (error) {
		// Log and handle any errors
		// eslint-disable-next-line no-console
		console.error(
			'Error occurred while removing non-command messages from public command channel:',
			error,
		);
	}
}
