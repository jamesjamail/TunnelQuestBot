import { Client } from 'discord.js';
import { BotEvent } from '../types';
import { color } from '../functions';
import { startLoggingAllServers } from '../lib/parser';
import { initializePrisma } from '../prisma/init';

const event: BotEvent = {
	name: 'ready',
	once: true,
	execute: async (client: Client) => {
		console.log(
			color(
				'text',
				`💪 Logged in as ${color(
					'variable',
					client.user?.tag as string,
				)}`,
			),
		);
		await initializePrisma();
		await startLoggingAllServers();
	},
};

export default event;
