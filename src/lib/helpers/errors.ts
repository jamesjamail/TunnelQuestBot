import { Interaction, TextChannel } from 'discord.js';
import { client } from '../..';
import { SlashCommand } from '../../types';

// 	catch blocks and rejected promises can carry anything, not just Errors
export function normalizeError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}
	if (typeof error === 'string') {
		return new Error(error);
	}
	try {
		return new Error(JSON.stringify(error));
	} catch {
		return new Error(String(error));
	}
}

async function reportErrorToDiscord(
	errorMessage: string,
	error: Error,
	extraData?: object,
) {
	const errorChannelId = process.env.ERROR_LOG_CHANNEL_ID;

	if (!errorChannelId) {
		throw new Error(
			'Error log channel ID is missing in environment variables.',
		);
	}

	// 	before login (or during a gateway outage) there is no usable REST session,
	// 	so reporting would fail anyway and only mask the original error
	if (!client.isReady()) {
		throw new Error(
			'Discord client is not ready; error was logged to console only.',
		);
	}

	const channel = await client.channels.fetch(errorChannelId);

	if (!channel) {
		throw new Error('Error log channel specified is invalid.');
	}

	if (!channel.isTextBased()) {
		throw new Error('Error log channel is not a text channel.');
	}

	const textChannel = channel as TextChannel;
	const sentMessage = await textChannel.send(errorMessage);

	// 	the thread is a nicety - losing it should not discard the message above
	try {
		const errorThread = await sentMessage.startThread({
			name: `error-${Math.floor(Date.now() / 1000)}`,
			autoArchiveDuration: 60 * 24, // One Day
		});
		await errorThread.send(`Stack:\n\`\`\`\n${error.stack}\n\`\`\``);
		if (extraData) {
			await errorThread.send(
				`Extra data:\n\`\`\`json\n${JSON.stringify(extraData)}\n\`\`\``,
			);
		}
	} catch (threadError) {
		console.error('ERROR WRITING ERROR THREAD TO DISCORD: ', threadError);
	}
}

export async function gracefullyHandleError(
	error: unknown,
	interaction?: Interaction,
	command?: SlashCommand,
	extraData?: object,
) {
	const normalizedError = normalizeError(error);

	let errorMessage = `An error occured: ${normalizedError.message}`;
	// include interaction info if available
	if (interaction) {
		errorMessage = `<@${interaction.user.id}> triggered the following error:\n \`\`${normalizedError.message}\`\``;
	}

	if (interaction && command) {
		errorMessage = `<@${interaction.user.id}> triggered the following error using the \`\`${command.command.name}\`\` command:\n \`\`${normalizedError.message}\`\``;
	}

	// Log the error to the console - warning level so we can reserve error level for
	// error-logging-to-discord failures
	console.warn(errorMessage);
	console.warn(normalizedError);

	// 	this is the last line of defense for most callers, so it must never reject -
	// 	a throw here would replace a handled error with an unhandled one
	try {
		await reportErrorToDiscord(errorMessage, normalizedError, extraData);
	} catch (loggingError) {
		console.error('ERROR LOGGING ERROR TO DISCORD: ', loggingError);
		console.error('ORIGINAL ERROR THAT FAILED TO SEND: ', normalizedError);
	}
}
