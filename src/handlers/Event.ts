import { Client } from 'discord.js';
import { join } from 'path';
import { loadEvents } from './eventLoader';

module.exports = (client: Client) => {
	const eventsDir = join(__dirname, '../events');
	loadEvents(eventsDir, client);
};
