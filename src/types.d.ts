import {
	SlashCommandOptionsOnlyBuilder,
	Collection,
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

export interface BotEvent {
	name: string;
	once?: boolean | false;
	// discord.js passes heterogeneous event args; callers cast at the boundary
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	execute: (...args: any[]) => Promise<unknown> | void;
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			TOKEN: string;
			CLIENT_ID: string;
		}
	}
}

declare module 'discord.js' {
	export interface Client {
		slashCommands: Collection<string, SlashCommand>;
		cooldowns: Collection<string, number>;
	}
}
