import { Prisma, SnoozedWatch, Watch } from '@prisma/client';
import { CommandInteraction } from 'discord.js';
import { ButtonInteractionTypes } from '../content/buttons/buttonBuilder';
import { parseInput, prefixJSON } from './autocomplete';

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

type WatchWithSnoozedWatches = Watch & {
	snoozedWatches: SnoozedWatch[];
};

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

export function formatSnoozedWatchResult(
	data: SnoozedWatch & { watch: Watch },
): WatchWithSnoozedWatches {
	// Extracting the watch data from the response
	const { watch, ...snoozedWatchData } = data;
	// Constructing the new formatted result
	const formattedResult: WatchWithSnoozedWatches = {
		...watch, // spreading watch data
		snoozedWatches: Object.keys(snoozedWatchData).length
			? [{ ...snoozedWatchData }]
			: [], // if empty obj, use empty array
	};

	return formattedResult;
}

export function getEnumKeyByEnumValue(
	myEnum: typeof ButtonInteractionTypes,
	enumValue: string,
): ButtonInteractionTypes | null {
	const keys = Object.values(myEnum).find((value) => value === enumValue);
	return keys ? (keys as ButtonInteractionTypes) : null;
}

type SnoozedWatchWithRelation = SnoozedWatch & {
	watch: Watch;
};

export function removeSnoozedWatchDataFromFormattedResult(
	dbResult: SnoozedWatchWithRelation,
	inaccurateData: WatchWithSnoozedWatches,
): WatchWithSnoozedWatches {
	// Extract the ID of the deleted snoozedWatch
	const deletedSnoozedWatchId = dbResult.id;

	// Filter out the deleted snoozedWatch from the snoozedWatches array
	const updatedSnoozedWatches = inaccurateData.snoozedWatches.filter(
		(sw) => sw.id !== deletedSnoozedWatchId,
	);

	// Return the modified inaccurateData
	return {
		...inaccurateData,
		snoozedWatches: updatedSnoozedWatches,
	};
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
