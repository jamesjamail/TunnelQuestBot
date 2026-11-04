import { vi } from 'vitest';
vi.mock('../../../prisma/dbExecutors/block', () => ({
	getHiddenTraders: vi.fn(async () => []),
}));
vi.mock('../../../prisma/dbExecutors/marketplace', () => ({
	getMarketplaceViewsForUser: vi.fn(async () => []),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { autocompleteMarketplaceTraders } from './autocompleteMarketplaceTraders';
import { getHiddenTraders } from '../../../prisma/dbExecutors/block';
import { getMarketplaceViewsForUser } from '../../../prisma/dbExecutors/marketplace';
import {
	makeAutocompleteInteraction,
	makeWatchWithUser,
} from '../../../test/factories';

function focused(name: string, value = '') {
	return makeAutocompleteInteraction({
		options: { getFocused: vi.fn(() => ({ name, value })) },
	});
}

function counterpart(id: string, username: string) {
	return {
		matchId: 1,
		side: 'wtb' as const,
		notified: false,
		watch: makeWatchWithUser(
			{ discordUserId: id },
			{ discordUserId: id, discordUsername: username },
		),
	};
}

describe('autocompleteMarketplaceTraders', () => {
	beforeEach(() => {
		vi.mocked(getHiddenTraders).mockReset().mockResolvedValue([]);
		vi.mocked(getMarketplaceViewsForUser).mockReset().mockResolvedValue([]);
	});

	it('offers the traders currently matched with the user for hide, valued by discord id', async () => {
		vi.mocked(getMarketplaceViewsForUser).mockResolvedValue([
			{
				watch: makeWatchWithUser(),
				counterparts: [
					counterpart('201', 'Ogrelord'),
					counterpart('202', 'Gnomeboy'),
				],
			},
		]);
		const interaction = focused('hide');

		await autocompleteMarketplaceTraders(interaction);

		expect(getMarketplaceViewsForUser).toHaveBeenCalledWith('100');
		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'Ogrelord', value: '201' },
			{ name: 'Gnomeboy', value: '202' },
		]);
	});

	it('offers a trader once, however many of their watches match', async () => {
		vi.mocked(getMarketplaceViewsForUser).mockResolvedValue([
			{
				watch: makeWatchWithUser(),
				counterparts: [counterpart('201', 'Ogrelord')],
			},
			{
				watch: makeWatchWithUser(),
				counterparts: [counterpart('201', 'Ogrelord')],
			},
		]);
		const interaction = focused('hide');

		await autocompleteMarketplaceTraders(interaction);

		expect(vi.mocked(interaction.respond).mock.calls[0][0]).toHaveLength(1);
	});

	it('filters by what has been typed, ignoring case', async () => {
		vi.mocked(getMarketplaceViewsForUser).mockResolvedValue([
			{
				watch: makeWatchWithUser(),
				counterparts: [
					counterpart('201', 'Ogrelord'),
					counterpart('202', 'Gnomeboy'),
				],
			},
		]);
		const interaction = focused('hide', 'GNOME');

		await autocompleteMarketplaceTraders(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'Gnomeboy', value: '202' },
		]);
	});

	it('offers hidden traders for unhide, falling back to the id when the name is unknown', async () => {
		vi.mocked(getHiddenTraders).mockResolvedValue([
			{ hiddenDiscordUserId: '201', discordUsername: 'Ogrelord' },
			{ hiddenDiscordUserId: '999', discordUsername: undefined },
		]);
		const interaction = focused('unhide');

		await autocompleteMarketplaceTraders(interaction);

		expect(getHiddenTraders).toHaveBeenCalledWith('100');
		expect(getMarketplaceViewsForUser).not.toHaveBeenCalled();
		expect(interaction.respond).toHaveBeenCalledWith([
			{ name: 'Ogrelord', value: '201' },
			{ name: '999', value: '999' },
		]);
	});

	it("caps the choices at Discord's limit of 25", async () => {
		vi.mocked(getHiddenTraders).mockResolvedValue(
			Array.from({ length: 40 }, (_, i) => ({
				hiddenDiscordUserId: `${i}`,
				discordUsername: `Trader${i}`,
			})),
		);
		const interaction = focused('unhide');

		await autocompleteMarketplaceTraders(interaction);

		expect(vi.mocked(interaction.respond).mock.calls[0][0]).toHaveLength(
			25,
		);
	});

	it('responds with nothing when there is nobody to offer', async () => {
		const interaction = focused('hide');

		await autocompleteMarketplaceTraders(interaction);

		expect(interaction.respond).toHaveBeenCalledWith([]);
	});
});
