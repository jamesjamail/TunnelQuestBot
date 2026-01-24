import { Interaction, TextChannel } from 'discord.js';
import { client } from '../..';
import { SlashCommand } from '../../types';

export async function gracefullyHandleError(
	error: Error,
	interaction?: Interaction,
	command?: SlashCommand,
	extraData?: object,
) {
	let errorMessage = `An error occured: ${error.message}`;
	// include interaction info if available
	if (interaction) {
		errorMessage = `<@${interaction.user.id}> triggered the following error:\n \`\`${error.message}\`\``;
	}

	if (interaction && command) {
		errorMessage = `<@${interaction.user.id}> triggered the following error using the \`\`${command.command.name}\`\` command:\n \`\`${error.message}\`\``;
	}

	// Log the error to the console - warning level so we can reserve error level for
	// error-logging-to-discord failures
	console.warn(errorMessage);
	console.warn(error);

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
		await textChannel
			.send(errorMessage)
			.then((sentMessage) => {
				sentMessage
					.startThread({
						name: `error-${Math.floor(Date.now() / 1000)}`,
						autoArchiveDuration: 60 * 24, // One Day
					})
					.then((errorThread) => {
						errorThread.send(
							`Stack:\n\`\`\`\n${error.stack}\n\`\`\``,
						);
						if (extraData) {
							errorThread.send(
								`Extra data:\n\`\`\`json\n${JSON.stringify(
									extraData,
								)}\n\`\`\``,
							);
						}
					});
			})
			.catch((loggingError) => {
				console.error('ERROR LOGGING ERROR TO DISCORD: ', loggingError);
				console.error('ORIGINAL ERROR THAT FAILED TO SEND: ', error);
			});
	}
}
