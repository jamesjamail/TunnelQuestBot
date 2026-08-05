import {
	SlashCommandOptionsOnlyBuilder,
	Collection,
	PermissionResolvable,
	Message,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
} from 'discord.js';

// 	these return promises rather than void so the compiler flags callers that
// 	forget to await them - a floating rejection here takes down the process
export interface SlashCommand {
	command: SlashCommandOptionsOnlyBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
	autocomplete?: (interaction: AutocompleteInteraction) => Promise<unknown>;
	cooldown?: number; // in seconds
}

export interface Command {
	name: string;
	execute: (message: Message, args: Array<string>) => void;
	permissions: Array<PermissionResolvable>;
	aliases: Array<string>;
	cooldown?: number;
}

interface GuildOptions {
	prefix: string;
}

export type GuildOption = keyof GuildOptions;
export interface BotEvent {
	name: string;
	once?: boolean | false;
	execute: (...args) => Promise<unknown> | void;
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			TOKEN: string;
			CLIENT_ID: string;
			PREFIX: string;
			MONGO_URI: string;
			MONGO_DATABASE_NAME: string;
		}
	}
}

declare module 'discord.js' {
	export interface Client {
		slashCommands: Collection<string, SlashCommand>;
		commands: Collection<string, Command>;
		cooldowns: Collection<string, number>;
	}
}
