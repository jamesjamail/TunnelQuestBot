import { BlockedPlayer, Prisma, Server, Watch } from '@prisma/client';
import { CommandInteraction } from 'discord.js';
import { ButtonInteractionTypes } from '../content/buttons/buttonBuilder';
import { parseInput, prefixJSON } from './autocomplete';
import { isPast } from 'date-fns';

type AllowedOptionValues = string | number | boolean;

// Define structure for a parsed argument
type ParsedOption = {
	value: AllowedOptionValues;
	autoSuggestionMetaData?: Record<string, unknown>;
	isAutoSuggestion: boolean;
};

// This will redefine ArgType to produce a type based on T, but with the above structure for each property.
type ArgType<T extends Record<string, AllowedOptionValues>> = {
	[K in keyof T]: ParsedOption;
};

export function getInteractionArgs<
	T extends Record<string, AllowedOptionValues>,
>(
	interaction: CommandInteraction,
	mandatoryArgs: (keyof T)[],
	optionalArgs: (keyof T)[] = [],
): ArgType<T> {
	const result: Partial<ArgType<T>> = {};

	const allArgs = [...mandatoryArgs, ...optionalArgs];

	// Collect values for both mandatory and optional arguments
	for (const arg of allArgs) {
		const option = interaction.options.get(arg as string);

		if (option?.value) {
			const parsed = parseInput(option.value as string);

			// Assigning the parsed value with the desired structure
			result[arg] = {
				value: parsed.userSubmittedValue || '', // Ensuring there's always a value
				autoSuggestionMetaData: parsed.autoSuggestedValue,
				isAutoSuggestion: !!parsed.autoSuggestedValue,
			};
		}
	}

	// Check if all mandatory arguments have been provided
	for (const arg of mandatoryArgs) {
		if (result[arg] === undefined) {
			throw new Error(`Missing required argument: ${String(arg)}`);
		}
	}

	return result as ArgType<T>;
}

// I knew typescript wouldn't like this, but I prefer to redefining table names
export function formatTopLevelDbResponses(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	result: any,
	modelName: keyof typeof Prisma.ModelName,
) {
	// Convert the first letter to lowercase
	const formattedModelName =
		modelName.charAt(0).toLowerCase() + modelName.slice(1);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const formattedResult: any = {
		[formattedModelName]: {},
	};

	// Loop over the result's keys
	for (const key of Object.keys(result)) {
		// If the key does not exist in the Prisma.ModelName, we nest it under the modelName.
		// Otherwise, they are treated as related models and kept at the top level.
		if (!(key in Prisma.ModelName)) {
			formattedResult[formattedModelName][key] = result[key];
		} else {
			formattedResult[key] = result[key];
		}
	}

	return formattedResult;
}

export function getEnumKeyByEnumValue(
	myEnum: typeof ButtonInteractionTypes,
	enumValue: string,
): ButtonInteractionTypes | null {
	const keys = Object.values(myEnum).find((value) => value === enumValue);
	return keys ? (keys as ButtonInteractionTypes) : null;
}

export function parseWatchesForAutoSuggest(
	watches: Watch[],
): { name: string; value: string }[] {
	// Check for unique servers and watchTypes
	const uniqueServers = new Set(watches.map((watch) => watch.server));
	const uniqueWatchTypes = new Set(watches.map((watch) => watch.watchType));

	const isMultipleServers = uniqueServers.size > 1;
	const isMultipleWatchTypes = uniqueWatchTypes.size > 1;

	return watches.map((watch) => {
		let itemName = watch.itemName;
		const extraInfo = [];

		if (isMultipleWatchTypes) {
			extraInfo.push(watch.watchType);
		}

		if (isMultipleServers) {
			extraInfo.push(watch.server);
		}

		if (extraInfo.length) {
			itemName = `${watch.itemName} (${extraInfo.join(', ')})`;
		}

		return {
			name: itemName,
			// max length of value is 100, so only adding essential metadata
			value: prefixJSON(JSON.stringify({ watch: { id: watch.id } })),
		};
	});
}

export function parseBlockedPlayersForAutoSuggest(
	blockedPlayers: BlockedPlayer[],
): { name: string; value: string }[] {
	// Check for unique servers
	const uniqueServers = new Set(blockedPlayers.map((bp) => bp.server));

	const isMultipleServers = uniqueServers.size > 1;

	return blockedPlayers.map((bp) => {
		let playerName = bp.player;
		const extraInfo = [];

		if (isMultipleServers) {
			extraInfo.push(bp.server);
		}

		if (extraInfo.length) {
			playerName = `${bp.player} (${extraInfo.join(', ')})`;
		}

		return {
			name: playerName,
			// max length of value is 100, so only adding essential metadata
			value: prefixJSON(JSON.stringify({ blockedPlayer: { id: bp.id } })),
		};
	});
}

export function isSnoozed(timestamp: Date | null) {
	// null value indicates no snooze
	if (!timestamp) return false;

	const snoozedUntil = new Date(timestamp);
	return !isPast(snoozedUntil) as boolean;
}

export function formatServerFromEnum(server: Server) {
	return `Project 1999 ${server.toLowerCase()} server`;
}

export function formatPriceNumberToReadableString(price: number): string {
	if (price < 1000) {
		// Price is less than 1000
		return price + 'pp';
	} else {
		// Calculate price in thousands with two decimal places
		const priceInThousands = price / 1000;
		const roundedPrice = Math.round(priceInThousands * 100) / 100; // Round to two decimal places

		if (roundedPrice * 1000 === price) {
			// If rounded value multiplied by 1000 equals the original price, use the 'k' format
			return roundedPrice + 'k';
		} else {
			// Otherwise, format with commas and append 'pp'
			const formattedPrice = price.toLocaleString('en-US');
			return formattedPrice + 'pp';
		}
	}
}
