const jsonPrefix = '::JSON::';

/**
 * Check if a given option value has the special prefix and is possibly JSON.
 */
function isPrefixedJSON(input: string | number): boolean {
	if (typeof input === 'string') {
		return input.startsWith(jsonPrefix);
	}
	// numbers will always be from a select list and
	//  will not have auto suggested meta data
	return false;
}

/**
 * Adds the special prefix to a string.
 */
export function prefixJSON(jsonString: string): string {
	return jsonPrefix + jsonString;
}

/**
 * Separates auto-suggested and user-submitted values.
 */
export function parseInput(input: string): {
	autoSuggestedValue?: Record<string, unknown>;
	userSubmittedValue?: string;
} {
	if (isPrefixedJSON(input)) {
		try {
			// Attempt to parse it as JSON after removing the prefix
			const jsonValue = JSON.parse(input.slice(jsonPrefix.length));
			return {
				autoSuggestedValue: jsonValue,
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('Failed to parse input as JSON', error);
			return { userSubmittedValue: input }; // if failed, return the original string as value
		}
	} else {
		return { userSubmittedValue: input }; // It's a regular string
	}
}
