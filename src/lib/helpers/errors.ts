/* eslint-disable no-console */
import { Interaction, TextChannel } from 'discord.js';
import { client } from '../..';
import { SlashCommand } from '../../types';

export async function gracefullyHandleError(
	error: Error,
	interaction?: Interaction,
	command?: SlashCommand,
) {
	let errorMessage = `An error occured: ${error.message}`;
	// include interaction info if available
	if (interaction) {
		errorMessage = `${interaction.user.displayName} triggered the following error:\n \`\`${error.message}\`\``;
	}

	if (interaction && command) {
		errorMessage = `${interaction.user.displayName} triggered the following error using the \`\`${command.command.name}\`\` command:\n \`\`${error.message}\`\``;
	}

	// Log the error to the console - warning level so we can reserve error level for
	// error-logging-to-discord failures
	console.warn(errorMessage);

	const errorChannelId = process.env.ERROR_LOG_CHANNEL_ID;

	// Check if the error logging channel ID is provided
	if (!errorChannelId) {
		throw new Error(
			'Error log channel ID is missing in environment variables.',
		);
	}

	// Get the channel from the client by ID
	const channel = await client.channels.fetch(errorChannelId);

	if (!channel) {
		throw new Error('Error log channel specified is invalid.');
	}

	if (!channel.isTextBased()) {
		throw new Error('Error log channel is not a text channel.');
	}

	// Check if the channel is a text channel and send a message
	if (channel && channel.isTextBased()) {
		const textChannel = channel as TextChannel;
		await textChannel.send(errorMessage).catch((loggingError) => {
			console.error('ERROR LOGGING ERROR TO DISCORD: ', loggingError);
			console.error('ORIGINAL ERROR THAT FAILED TO SEND: ', error);
		});
	}
}
