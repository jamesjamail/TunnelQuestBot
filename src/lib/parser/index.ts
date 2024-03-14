import { runPlayerLinkHousekeeping } from '../../prisma/dbExecutors/playerLink';
import {
	getWatchesGroupedByServer,
	deleteWatchesOlderThanWatchdurationDays,
} from '../../prisma/dbExecutors/watch';
import { monitorLogFile } from './monitorLogs';
import { state, events } from './state';
import { Server } from '@prisma/client';
import inspector from 'node:inspector';

export async function startLoggingAllServers() {
	// Set DEBUG_MODE variable for use elsewhere
	globalThis.DEBUG_MODE = inspector.url() != undefined;
	globalThis.debug_console = function (message) {
		if (globalThis.DEBUG_MODE) {
			// eslint-disable-next-line no-console
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
	setInterval(async () => {
		const updatedWatchedItems = await getWatchesGroupedByServer();
		Object.assign(state.watchedItems, updatedWatchedItems);
		events.emit('watchedItemsUpdated');
	}, 60000);

	// remove expired watches
	setInterval(async () => {
		deleteWatchesOlderThanWatchdurationDays();
	}, 60000);

	// remove expired player link
	setInterval(async () => {
		await runPlayerLinkHousekeeping();
	}, 60000);
}
