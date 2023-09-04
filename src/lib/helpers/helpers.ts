import { Prisma, SnoozedWatch, Watch } from '@prisma/client';
import { CommandInteraction } from 'discord.js';
import { ButtonInteractionTypes } from '../content/buttons/buttonBuilder';

// helper type to map between argument names and their types
type ArgType<T, K extends keyof T> = T[K];

type AllowedOptionValues = string | number | boolean;

export function getInteractionArgs<
	T extends Record<string, AllowedOptionValues>,
>(interaction: CommandInteraction, argNames: (keyof T)[]): T {
	const result: Partial<T> = {};

	for (const arg of argNames) {
		const option = interaction.options.get(arg as string);

		if (option?.value && isAllowedOptionValue(option.value)) {
			// Cast to correct type using our helper type
			result[arg] = option.value as ArgType<T, typeof arg>;
		}
	}

	for (const arg of argNames) {
		if (result[arg] === undefined) {
			throw new Error(`Missing required argument: ${String(arg)}`);
		}
	}

	return result as T;
}

function isAllowedOptionValue(value: unknown): value is AllowedOptionValues {
	return (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	);
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
