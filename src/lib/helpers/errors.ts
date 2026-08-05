import { Interaction, TextChannel } from 'discord.js';
import crypto from 'crypto';
import { client } from '../..';
import { SlashCommand } from '../../types';

// 	A repeating failure - a database outage, a duplicate-interaction storm - can
// 	raise an error for every auction line. Each report costs a message, a thread
// 	and a stack post, so unthrottled reporting buries the channel in threads and
// 	burns the rate limit exactly when the bot is already struggling.
//
// 	State is deliberately in-memory rather than in Redis: the reporter must not
// 	depend on a service that may itself be the thing that is failing.
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_ERRORS = 500;
const MAX_REPORTS_PER_MINUTE = 10;

const lastReportedAt = new Map<string, number>();
let rateWindowStartedAt = 0;
let reportsInRateWindow = 0;

function pruneReportHistory(now: number) {
	for (const [key, reportedAt] of lastReportedAt) {
		if (now - reportedAt >= DEDUPE_WINDOW_MS) {
			lastReportedAt.delete(key);
		}
	}

	// 	errors carrying unique ids never collide, so cap the map regardless.
	// 	Map iterates in insertion order, so this drops the oldest entries.
	for (const key of lastReportedAt.keys()) {
		if (lastReportedAt.size <= MAX_TRACKED_ERRORS) break;
		lastReportedAt.delete(key);
	}
}

// 	backstop for floods that dedupe cannot catch, such as errors whose message
// 	embeds a unique interaction id
function hasExceededReportRate(now: number) {
	if (now - rateWindowStartedAt >= 60 * 1000) {
		rateWindowStartedAt = now;
		reportsInRateWindow = 0;
	}

	reportsInRateWindow += 1;

	if (reportsInRateWindow === MAX_REPORTS_PER_MINUTE + 1) {
		console.warn(
			`Reached ${MAX_REPORTS_PER_MINUTE} error reports in a minute; suppressing further reports to Discord until the next minute. Errors are still logged here.`,
		);
	}

	return reportsInRateWindow > MAX_REPORTS_PER_MINUTE;
}

function shouldReportToDiscord(error: Error, now: number) {
	pruneReportHistory(now);

	// 	the stack already begins with the error message, so it identifies both
	// 	what failed and where
	const key = crypto
		.createHash('sha256')
		.update(error.stack ?? `${error.name}: ${error.message}`)
		.digest('hex');

	const reportedAt = lastReportedAt.get(key);
	if (reportedAt !== undefined && now - reportedAt < DEDUPE_WINDOW_MS) {
		return false;
	}

	if (hasExceededReportRate(now)) {
		return false;
	}

	// 	recorded only once the report actually goes out, so an error dropped by
	// 	the rate limit is not also silenced by the dedupe window
	lastReportedAt.set(key, now);
	return true;
}

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

	// 	throttling applies only to Discord; the console above keeps every error
	if (!shouldReportToDiscord(normalizedError, Date.now())) {
		return;
	}

	// 	this is the last line of defense for most callers, so it must never reject -
	// 	a throw here would replace a handled error with an unhandled one
	try {
		await reportErrorToDiscord(errorMessage, normalizedError, extraData);
	} catch (loggingError) {
		console.error('ERROR LOGGING ERROR TO DISCORD: ', loggingError);
		console.error('ORIGINAL ERROR THAT FAILED TO SEND: ', normalizedError);
	}
}
