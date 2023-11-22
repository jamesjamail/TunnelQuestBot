import { CommandInteraction } from 'discord.js';
import { parseInput } from './autocomplete/autocompleteHelpers';

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
		// be explicit in order to allow 0 value
		if (option?.value !== null && option?.value !== undefined) {
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
