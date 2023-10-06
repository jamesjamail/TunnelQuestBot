import { monitorLogFile } from './parser';
import { getWatchesGroupedByServer } from '../../prisma/dbExecutors';
import { state, events } from './state';
import { Server } from '@prisma/client';

export async function startLoggingAllServers() {
	// Initial fetch
	const allWatchedItems = await getWatchesGroupedByServer();
	state.watchedItems = allWatchedItems;

	// Initialize log parsing
	for (const server of Object.keys(allWatchedItems)) {
		monitorLogFile(server as Server);
	}

	// Update watchedItems every 60 seconds
	setInterval(async () => {
		const updatedWatchedItems = await getWatchesGroupedByServer();
		Object.assign(state.watchedItems, updatedWatchedItems);
		events.emit('watchedItemsUpdated');
	}, 60000);
}
