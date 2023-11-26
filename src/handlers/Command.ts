/* eslint-disable no-console */
import { Client, Routes, SlashCommandBuilder } from 'discord.js';
import { REST } from '@discordjs/rest';
import { readdirSync } from 'fs';
import { join } from 'path';
import { color } from '../functions';
import { SlashCommand } from '../types';
import { gracefullyHandleError } from '../lib/helpers/errors';

module.exports = (client: Client) => {
	const slashCommands: SlashCommandBuilder[] = [];
	// this template also contained a /commands folder for non-slashCommands, but it was removed as TQB
	// exclusively uses slashCommands.  If regular commmands are ever needed, refer to template (see readme).
	const slashCommandsDir = join(__dirname, '../lib/commands/slashCommands');

	readdirSync(slashCommandsDir).forEach((file) => {
		if (!file.endsWith('.js') || file.startsWith('_')) return;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const command: SlashCommand = require(
			`${slashCommandsDir}/${file}`,
		).default;
		slashCommands.push(command.command);
		client.slashCommands.set(command.command.name, command);
	});

	const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

	rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
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
};
