import { runPlayerLinkHousekeeping } from '../../prisma/dbExecutors/playerLink';
import {
	getWatchesGroupedByServer,
	deleteWatchesOlderThanWatchdurationDays,
} from '../../prisma/dbExecutors/watch';
import { removeNoncommandMessagesFromPublicCommandSpace } from '../helpers/removeMessagesFromCommandSpace';
import { monitorLogFile } from './monitorLogs';
import { state } from './state';
import { Server } from '../../prisma/client';
import { gracefullyHandleError } from '../helpers/errors';

// 	setInterval ignores the promise an async callback returns, so a rejected
// 	housekeeping run would surface as an unhandled rejection and end the process
function safeInterval(task: () => Promise<void>, intervalMs: number) {
	return setInterval(() => {
		void task().catch((error) => gracefullyHandleError(error));
	}, intervalMs);
}

export async function startLoggingAllServers() {
	// Set DEBUG_MODE variable for use elsewhere
	globalThis.DEBUG_MODE = !!(process.env.DEBUG_MODE || 'false').match(
		/^[tT]/,
	);
	globalThis.debug_console = (message) => {
		if (globalThis.DEBUG_MODE) {
			console.log(message);
		}
	};

	// Initial fetch
	const allWatchedItems = await getWatchesGroupedByServer();
	state.watchedItems = allWatchedItems;

	// Initialize log parsing for each server
	for (const server of Object.keys(Server)) {
		monitorLogFile(server as Server);
	}

	// Update watchedItems every 60 seconds
	safeInterval(async () => {
		const updatedWatchedItems = await getWatchesGroupedByServer();
		state.watchedItems = updatedWatchedItems;
	}, 60000);

	// remove expired watches
	safeInterval(async () => {
		await deleteWatchesOlderThanWatchdurationDays();
	}, 60000);

	// remove expired player link
	safeInterval(async () => {
		await runPlayerLinkHousekeeping();
	}, 60000);

	// clean up non-commands in #public_command_space channel
	safeInterval(async () => {
		await removeNoncommandMessagesFromPublicCommandSpace();
	}, 10000);
}
