import { Client, Routes, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { REST } from '@discordjs/rest';
import { readdirSync } from 'fs';
import { color } from '../functions';
import { SlashCommand } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';

export function loadSlashCommands(
	slashCommandsDir: string,
	client: Client,
): SlashCommandOptionsOnlyBuilder[] {
	const slashCommands: SlashCommandOptionsOnlyBuilder[] = [];
	readdirSync(slashCommandsDir).forEach((file) => {
		if (!file.endsWith('.js') || file.startsWith('_')) return;

		const command: SlashCommand = require(
			`${slashCommandsDir}/${file}`,
		).default;
		slashCommands.push(command.command);
		client.slashCommands.set(command.command.name, command);
	});
	return slashCommands;
}

export async function registerSlashCommands(
	slashCommands: SlashCommandOptionsOnlyBuilder[],
): Promise<void> {
	const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

	await rest
		.put(Routes.applicationCommands(process.env.CLIENT_ID), {
			body: slashCommands.map((command) => command.toJSON()),
		})
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		.then((data: any) => {
			console.log(
				color(
					'text',
					`🔥 Successfully loaded ${color(
						'variable',
						data.length,
					)} slash command(s)`,
				),
			);
		})
		.catch(async (e) => {
			await gracefullyHandleError(e);
		});
}
