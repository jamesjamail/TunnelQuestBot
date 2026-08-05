import { Client } from 'discord.js';
import { join } from 'path';
import { loadSlashCommands, registerSlashCommands } from './commandLoader';

module.exports = (client: Client) => {
	const slashCommandsDir = join(__dirname, '../lib/commands/slashCommands');
	const slashCommands = loadSlashCommands(slashCommandsDir, client);
	void registerSlashCommands(slashCommands);
};
