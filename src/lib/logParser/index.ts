import { monitorLogFile } from './parser';
import {
	deleteWatchesOlderThanSeverDays,
	getWatchesGroupedByServer,
	runPlayerLinkHousekeeping,
} from '../../prisma/dbExecutors';
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

	// TODO: make a decision about including console statements here or in the dbExecutors themselves

	// remove expired watches
	setInterval(async () => {
		deleteWatchesOlderThanSeverDays();
	}, 60000);

	setInterval(async () => {
		const cleanedRecords = await runPlayerLinkHousekeeping();
		if (cleanedRecords.count > 0) {
			// eslint-disable-next-line no-console
			console.info(
				`Deleted ${cleanedRecords.count} expired PlayerLink entries.`,
			);
		}
	}, 60000);
}
