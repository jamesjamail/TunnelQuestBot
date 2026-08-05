import { vi } from 'vitest';

import { describe, it, expect, beforeEach } from 'vitest';
import {
	prefixJSON,
	parseInput,
	respondToAutocomplete,
	parseWatchesForAutocomplete,
	parseBlockedPlayersForAutocomplete,
} from './autocompleteHelpers';
import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { Server, WatchType } from '@prisma/client';
import {
	makeWatch,
	makeBlockedPlayer,
	makeAutocompleteInteraction,
} from '../../../test/factories';

describe('prefixJSON and parseInput', () => {
	it('round-trips an object through prefixJSON and parseInput', () => {
		const metadata = { watch: { id: 7 } };
		const prefixed = prefixJSON(JSON.stringify(metadata));

		expect(parseInput(prefixed)).toEqual({
			autoSuggestedValue: metadata,
		});
	});

	it('parses a plain string as userSubmittedValue', () => {
		expect(parseInput('plain')).toEqual({ userSubmittedValue: 'plain' });
	});

	it('warns and returns the original string for malformed JSON', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const bad = '::JSON::{bad';

		expect(parseInput(bad)).toEqual({ userSubmittedValue: bad });
		expect(warnSpy).toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it('treats non-string input as non-prefixed JSON', () => {
		expect(parseInput(42 as unknown as string)).toEqual({
			userSubmittedValue: 42,
		});
	});
});

describe('respondToAutocomplete', () => {
	let interaction: ReturnType<typeof makeAutocompleteInteraction>;

	beforeEach(() => {
		interaction = makeAutocompleteInteraction();
	});

	it('forwards choices to interaction.respond', async () => {
		const choices = [{ name: 'A', value: 'a' }];
		await respondToAutocomplete(interaction, choices);

		expect(interaction.respond).toHaveBeenCalledWith(choices);
	});

	it('swallows UnknownInteraction DiscordAPIError', async () => {
		const err = new DiscordAPIError(
			{
				code: RESTJSONErrorCodes.UnknownInteraction,
				message: 'x',
			} as never,
			RESTJSONErrorCodes.UnknownInteraction,
			404,
			'POST',
			'url',
			{},
		);
		vi.mocked(interaction.respond).mockRejectedValueOnce(err);

		await expect(
			respondToAutocomplete(interaction, []),
		).resolves.toBeUndefined();
	});

	it('swallows InteractionHasAlreadyBeenAcknowledged DiscordAPIError', async () => {
		const err = new DiscordAPIError(
			{
				code: RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged,
				message: 'x',
			} as never,
			RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged,
			400,
			'POST',
			'url',
			{},
		);
		vi.mocked(interaction.respond).mockRejectedValueOnce(err);

		await expect(
			respondToAutocomplete(interaction, []),
		).resolves.toBeUndefined();
	});

	it('rethrows other errors', async () => {
		const err = new Error('boom');
		vi.mocked(interaction.respond).mockRejectedValueOnce(err);

		await expect(respondToAutocomplete(interaction, [])).rejects.toThrow(
			'boom',
		);
	});
});

describe('parseWatchesForAutocomplete', () => {
	it('returns an empty array for no watches', () => {
		expect(parseWatchesForAutocomplete([])).toEqual([]);
	});

	it('title-cases a single watch without suffix', () => {
		const [choice] = parseWatchesForAutocomplete([
			makeWatch({ id: 1, itemName: 'FLOWING BLACK SILK SASH' }),
		]);

		expect(choice.name).toBe('Flowing Black Silk Sash');
		expect(choice.value.length).toBeLessThan(100);
		expect(choice.value.startsWith('::JSON::')).toBe(true);
	});

	it('appends server when watches span multiple servers', () => {
		const choices = parseWatchesForAutocomplete([
			makeWatch({ id: 1, itemName: 'SWORD', server: Server.BLUE }),
			makeWatch({ id: 2, itemName: 'SWORD', server: Server.GREEN }),
		]);

		expect(choices[0].name).toMatch(/\(blue\)/i);
		expect(choices[1].name).toMatch(/\(green\)/i);
	});

	it('appends watch type when watches span multiple types', () => {
		const choices = parseWatchesForAutocomplete([
			makeWatch({ id: 1, itemName: 'SWORD', watchType: WatchType.WTS }),
			makeWatch({ id: 2, itemName: 'SWORD', watchType: WatchType.WTB }),
		]);

		expect(choices[0].name).toMatch(/\(wts\)/i);
		expect(choices[1].name).toMatch(/\(wtb\)/i);
	});

	it('appends watch type before server when both differ', () => {
		const choices = parseWatchesForAutocomplete([
			makeWatch({
				id: 1,
				itemName: 'SWORD',
				watchType: WatchType.WTS,
				server: Server.BLUE,
			}),
			makeWatch({
				id: 2,
				itemName: 'SWORD',
				watchType: WatchType.WTB,
				server: Server.GREEN,
			}),
		]);

		expect(choices[0].name).toMatch(/\(wts, blue\)/i);
		expect(choices[1].name).toMatch(/\(wtb, green\)/i);
	});

	it('encodes watch id in the prefixed JSON value', () => {
		const [choice] = parseWatchesForAutocomplete([makeWatch({ id: 99 })]);

		expect(choice.value).toBe(
			prefixJSON(JSON.stringify({ watch: { id: 99 } })),
		);
	});
});

describe('parseBlockedPlayersForAutocomplete', () => {
	it('returns an empty array for no blocks', () => {
		expect(parseBlockedPlayersForAutocomplete([])).toEqual([]);
	});

	it('title-cases a single blocked player without suffix', () => {
		const [choice] = parseBlockedPlayersForAutocomplete([
			makeBlockedPlayer({ id: 3, player: 'SOANDSO' }),
		]);

		expect(choice.name).toBe('Soandso');
		expect(choice.value).toBe(
			prefixJSON(JSON.stringify({ blockedPlayer: { id: 3 } })),
		);
	});

	it('appends server when blocks span multiple servers', () => {
		const choices = parseBlockedPlayersForAutocomplete([
			makeBlockedPlayer({
				id: 1,
				player: 'SOANDSO',
				server: Server.BLUE,
			}),
			makeBlockedPlayer({ id: 2, player: 'SOANDSO', server: Server.RED }),
		]);

		expect(choices[0].name).toMatch(/\(blue\)/i);
		expect(choices[1].name).toMatch(/\(red\)/i);
	});
});
