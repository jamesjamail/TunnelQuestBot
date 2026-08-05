import { describe, it, expect } from 'vitest';
import { getInteractionArgs } from './getInteractionsArgs';
import { ChatInputCommandInteraction } from 'discord.js';

describe('getInteractionArgs', () => {
	it('preserves a numeric zero value', () => {
		const interaction = {
			options: {
				get: (name: string) => (name === 'price' ? { value: 0 } : null),
			},
		} as unknown as ChatInputCommandInteraction;

		const result = getInteractionArgs<{ price: number }>(interaction, [
			'price',
		]);

		expect(result.price.value).toBe(0);
	});
});
