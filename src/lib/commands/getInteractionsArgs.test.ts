import { describe, it, expect } from 'vitest';
import { getInteractionArgs } from './getInteractionsArgs';
import { prefixJSON } from './autocomplete/autocompleteHelpers';
import type { ChatInputCommandInteraction } from 'discord.js';

function makeInteraction(
	getImpl: (name: string) => { value: unknown } | null,
): ChatInputCommandInteraction {
	return {
		options: { get: getImpl },
	} as unknown as ChatInputCommandInteraction;
}

describe('getInteractionArgs', () => {
	it('preserves a numeric zero value', () => {
		const interaction = makeInteraction((name) =>
			name === 'price' ? { value: 0 } : null,
		);

		const result = getInteractionArgs<{ price: number }>(interaction, [
			'price',
		]);

		expect(result.price.value).toBe(0);
	});

	it('throws when a mandatory argument is missing', () => {
		const interaction = makeInteraction(() => null);

		expect(() =>
			getInteractionArgs<{ watch: string }>(interaction, ['watch']),
		).toThrow('Missing required argument: watch');
	});

	it('omits missing optional arguments from the result', () => {
		const interaction = makeInteraction((name) =>
			name === 'watch' ? { value: 'FBSS' } : null,
		);

		const result = getInteractionArgs<{ watch: string; hours: number }>(
			interaction,
			['watch'],
			['hours'],
		);

		expect(result.hours).toBeUndefined();
	});

	it('preserves false for boolean options', () => {
		const interaction = makeInteraction((name) =>
			name === 'flag' ? { value: false } : null,
		);

		const result = getInteractionArgs<{ flag: boolean }>(interaction, [
			'flag',
		]);

		expect(result.flag.value).toBe(false);
	});

	it('parses a plain string without auto-suggestion metadata', () => {
		const interaction = makeInteraction((name) =>
			name === 'item' ? { value: 'FBSS' } : null,
		);

		const result = getInteractionArgs<{ item: string }>(interaction, [
			'item',
		]);

		expect(result.item).toEqual({
			value: 'FBSS',
			isAutoSuggestion: false,
			autoSuggestionMetaData: undefined,
		});
	});

	it('parses a JSON-prefixed auto-suggestion with an empty value', () => {
		const metadata = { watch: { id: 42 } };
		const interaction = makeInteraction((name) =>
			name === 'watch'
				? { value: prefixJSON(JSON.stringify(metadata)) }
				: null,
		);

		const result = getInteractionArgs<{ watch: string }>(interaction, [
			'watch',
		]);

		expect(result.watch).toEqual({
			value: '',
			isAutoSuggestion: true,
			autoSuggestionMetaData: metadata,
		});
	});

	it('treats malformed JSON prefix as a plain string', () => {
		const badValue = '::JSON::{bad';
		const interaction = makeInteraction((name) =>
			name === 'watch' ? { value: badValue } : null,
		);

		const result = getInteractionArgs<{ watch: string }>(interaction, [
			'watch',
		]);

		expect(result.watch).toEqual({
			value: badValue,
			isAutoSuggestion: false,
			autoSuggestionMetaData: undefined,
		});
	});

	it('collects mandatory and optional arguments in one call', () => {
		const interaction = makeInteraction((name) => {
			const values: Record<string, { value: unknown }> = {
				watch: { value: 'FBSS' },
				hours: { value: 6 },
			};
			return values[name] ?? null;
		});

		const result = getInteractionArgs<{ watch: string; hours: number }>(
			interaction,
			['watch'],
			['hours'],
		);

		expect(result.watch.value).toBe('FBSS');
		expect(result.hours.value).toBe(6);
	});
});
