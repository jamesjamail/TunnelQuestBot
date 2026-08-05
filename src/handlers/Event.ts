import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { color } from '../functions';
import { BotEvent } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';

module.exports = (client: Client) => {
	const eventsDir = join(__dirname, '../events');

	readdirSync(eventsDir).forEach((file) => {
		if (!file.endsWith('.js')) return;

		const event: BotEvent = require(`${eventsDir}/${file}`).default;
		// 	discord.js discards listener return values, so an async event that
		// 	rejects would otherwise escape as an unhandled rejection
		const listener = async (...args: unknown[]) => {
			try {
				await event.execute(...args);
			} catch (error) {
				await gracefullyHandleError(error);
			}
		};
		event.once
			? client.once(event.name, listener)
			: client.on(event.name, listener);
		console.log(
			color(
				'text',
				`🌠 Successfully loaded event ${color('variable', event.name)}`,
			),
		);
	});
};
