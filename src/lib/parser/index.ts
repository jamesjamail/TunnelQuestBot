import { runPlayerLinkHousekeeping } from '../../prisma/dbExecutors/playerLink';
import {
	getWatchesGroupedByServer,
	deleteWatchesOlderThanWatchdurationDays,
} from '../../prisma/dbExecutors/watch';
import { monitorLogFile } from './monitorLogs';
import { state, events } from './state';
import { Server } from '@prisma/client';

export async function startLoggingAllServers() {
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
