import type { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { color } from '../functions';
import type { BotEvent } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';

export function loadEvents(eventsDir: string, client: Client): string[] {
	const loadedEventNames: string[] = [];

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
		loadedEventNames.push(event.name);
	});

	return loadedEventNames;
}
