import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../../../config';
import { makeAutocompleteInteraction } from '../../../test/factories';
import { autocompleteServers } from './autocompleteServers';

const redClassic = process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
const redEmbedded = process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;

afterEach(() => {
	process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID = redClassic;
	process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID = redEmbedded;
	resetConfigCache();
});

describe('autocompleteServers', () => {
	it('returns only enabled servers', async () => {
		delete process.env.SERVERS_RED_STREAM_CHANNEL_CLASSIC_ID;
		delete process.env.SERVERS_RED_STREAM_CHANNEL_EMBEDDED_ID;
		resetConfigCache();
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: vi.fn(() => '') },
		});

		await autocompleteServers(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'blue server', value: 'BLUE' },
			{ name: 'green server', value: 'GREEN' },
		]);
	});

	it('filters enabled servers by the focused value', async () => {
		const interaction = makeAutocompleteInteraction({
			options: { getFocused: vi.fn(() => 'gr') },
		});

		await autocompleteServers(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'green server', value: 'GREEN' },
		]);
	});
});
