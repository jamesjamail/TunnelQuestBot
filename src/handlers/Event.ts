import { Client } from 'discord.js';
import { join } from 'path';
import { loadEvents } from './eventLoader';

export function registerEventHandlers(client: Client) {
	const eventsDir = join(__dirname, '../events');
	loadEvents(eventsDir, client);
}
