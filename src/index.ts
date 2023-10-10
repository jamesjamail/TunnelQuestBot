import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
const { Guilds, MessageContent, GuildMessages, GuildMembers, DirectMessages } =
	GatewayIntentBits;
export const client = new Client({
	intents: [
		Guilds,
		MessageContent,
		GuildMessages,
		GuildMembers,
		DirectMessages,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction], //	needed for handling interactions from DM's
});
import { Command, SlashCommand } from './types';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
config();

client.slashCommands = new Collection<string, SlashCommand>();
client.commands = new Collection<string, Command>();
client.cooldowns = new Collection<string, number>();

const handlersDir = join(__dirname, './handlers');
readdirSync(handlersDir).forEach((handler) => {
	if (!handler.endsWith('.js')) return;
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require(`${handlersDir}/${handler}`)(client);
});

client.login(process.env.TOKEN);
