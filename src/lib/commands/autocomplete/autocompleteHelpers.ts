import { Watch, BlockedPlayer } from '@prisma/client';
import { toTitleCase } from '../../helpers/titleCase';

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
			console.warn('Failed to parse input as JSON', error);
			return { userSubmittedValue: input }; // if failed, return the original string as value
		}
	} else {
		return { userSubmittedValue: input }; // It's a regular string
	}
}

export function parseWatchesForAutocomplete(
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
			name: toTitleCase(itemName),
			// max length of value is 100, so only adding essential metadata
			value: prefixJSON(JSON.stringify({ watch: { id: watch.id } })),
		};
	});
}

export function parseBlockedPlayersForAutocomplete(
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
			name: toTitleCase(playerName),
			// max length of value is 100, so only adding essential metadata
			value: prefixJSON(JSON.stringify({ blockedPlayer: { id: bp.id } })),
		};
	});
}
