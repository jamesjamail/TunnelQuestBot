import { runPlayerLinkHousekeeping } from '../../prisma/dbExecutors/playerLink';
import {
	getWatchesGroupedByServer,
	deleteWatchesOlderThanWatchdurationDays,
} from '../../prisma/dbExecutors/watch';
import { removeNoncommandMessagesFromPublicCommandSpace } from '../helpers/removeMessagesFromCommandSpace';
import { runMarketplaceMatchingSweep } from '../marketplace/marketplaceMatching';
import { monitorLogFile } from './monitorLogs';
import { state } from './state';
import { Server } from '../../prisma/client';
import { gracefullyHandleError } from '../helpers/errors';

// 	setInterval ignores the promise an async callback returns, so a rejected
// 	housekeeping run would surface as an unhandled rejection and end the process.
// 	The running guard skips a tick instead of overlapping if a prior run of the
// 	same task is still in flight (e.g. a marketplace sweep that outlasts its
// 	own interval under load) - none of these tasks are meant to run concurrently
// 	with themselves.
function safeInterval(task: () => Promise<void>, intervalMs: number) {
	let running = false;
	return setInterval(() => {
		if (running) return;
		running = true;
		void task()
			.catch((error) => gracefullyHandleError(error))
			.finally(() => {
				running = false;
			});
	}, intervalMs);
}

export async function startLoggingAllServers() {
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

	// safety net for marketplace pairings formed by a change on one side
	// after the other side's watch already existed (see buildMarketplacePreview
	// for the event-triggered path that catches most matches immediately)
	safeInterval(async () => {
		await runMarketplaceMatchingSweep();
	}, 300000);
}
