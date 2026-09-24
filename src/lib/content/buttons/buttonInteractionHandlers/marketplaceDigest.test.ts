import { vi } from 'vitest';
vi.mock(
	'../../../../index',
	() => import('../../../../test/mocks/discordClient'),
);
vi.mock(
	'../../../../prisma/init',
	() => import('../../../../test/mocks/prisma'),
);
vi.mock('../../../../redis/init', () => import('../../../../test/mocks/redis'));
vi.mock('../../../../prisma/dbExecutors/watch', () => ({
	snoozeWatch: vi.fn(async () => undefined),
	unsnoozeWatch: vi.fn(async () => undefined),
	unwatch: vi.fn(async () => undefined),
	setWatchActiveByWatchId: vi.fn(async () => undefined),
	extendWatch: vi.fn(async () => undefined),
	setWatchListed: vi.fn(async () => undefined),
}));
vi.mock('../../../../prisma/dbExecutors/marketplace', () => ({
	getMarketplaceViewForWatch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import {
	handleMarketplaceListedActive,
	handleMarketplaceListedInactive,
	handleMarketplaceRefresh,
	handleMarketplaceSnoozeActive,
	handleMarketplaceSnoozeInactive,
	handleMarketplaceUnwatchActive,
	handleMarketplaceUnwatchInactive,
} from './marketplaceDigest';
import {
	extendWatch,
	setWatchActiveByWatchId,
	setWatchListed,
	snoozeWatch,
	unsnoozeWatch,
	unwatch,
} from '../../../../prisma/dbExecutors/watch';
import { getMarketplaceViewForWatch } from '../../../../prisma/dbExecutors/marketplace';
import { messageCopy } from '../../copy/messageCopy';
import {
	makeButtonInteraction,
	makeWatch,
	makeWatchWithUser,
} from '../../../../test/factories';

function actionTypes(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0] as {
		components: {
			components: { data: { custom_id: string } }[];
		}[];
	};
	return payload.components[0].components.map(
		(c) => c.data.custom_id.split(':')[0],
	);
}

function updatePayload(interaction: ReturnType<typeof makeButtonInteraction>) {
	return vi.mocked(interaction.update).mock.calls[0][0] as {
		content: string;
		embeds: {
			toJSON: () => { description?: string; footer?: { text: string } };
		}[];
	};
}

describe('marketplace digest button handlers', () => {
	const watch = makeWatch({ id: 1 });

	beforeEach(() => {
		vi.mocked(getMarketplaceViewForWatch).mockReset();
		vi.mocked(getMarketplaceViewForWatch).mockResolvedValue({
			watch: makeWatchWithUser({ id: 1 }),
			counterparts: [],
		});
		for (const fn of [
			snoozeWatch,
			unsnoozeWatch,
			unwatch,
			setWatchActiveByWatchId,
			extendWatch,
			setWatchListed,
		]) {
			vi.mocked(fn).mockClear();
		}
	});

	it('snoozes the watch, then re-renders the digest from what is now stored', async () => {
		vi.mocked(getMarketplaceViewForWatch).mockResolvedValue({
			watch: makeWatchWithUser({
				id: 1,
				snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
			}),
			counterparts: [],
		});
		const interaction = makeButtonInteraction();

		await handleMarketplaceSnoozeInactive(interaction, watch);

		expect(snoozeWatch).toHaveBeenCalledWith(watch);
		expect(getMarketplaceViewForWatch).toHaveBeenCalledWith(1);
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(actionTypes(interaction)).toEqual([
			'MarketplaceSnoozeActive',
			'MarketplaceUnwatchInactive',
			'MarketplaceRefreshInactive',
			'MarketplaceListedActive',
		]);
		expect(updatePayload(interaction).content).toBe(
			messageCopy.yourWatchHasBeenSnoozed(),
		);
	});

	it('unsnoozes the watch', async () => {
		const interaction = makeButtonInteraction();

		await handleMarketplaceSnoozeActive(interaction, watch);

		expect(unsnoozeWatch).toHaveBeenCalledWith(watch);
		expect(actionTypes(interaction)[0]).toBe('MarketplaceSnoozeInactive');
	});

	it('ends the watch, and re-renders it as ended with the end button offering a restore', async () => {
		vi.mocked(getMarketplaceViewForWatch).mockResolvedValue({
			watch: makeWatchWithUser({ id: 1, active: false }),
			counterparts: [],
		});
		const interaction = makeButtonInteraction();

		await handleMarketplaceUnwatchInactive(interaction, watch);

		expect(unwatch).toHaveBeenCalledWith(watch);
		expect(actionTypes(interaction)[1]).toBe('MarketplaceUnwatchActive');
		expect(
			updatePayload(interaction).embeds[0].toJSON().description,
		).toContain('has ended');
	});

	it('restores an ended watch', async () => {
		const interaction = makeButtonInteraction();

		await handleMarketplaceUnwatchActive(interaction, watch);

		expect(setWatchActiveByWatchId).toHaveBeenCalledWith(1);
		expect(actionTypes(interaction)[1]).toBe('MarketplaceUnwatchInactive');
		expect(updatePayload(interaction).content).toBe(
			messageCopy.yourWatchHasBeenRestored(watch.itemName, watch.server),
		);
	});

	it('extends the watch', async () => {
		const interaction = makeButtonInteraction();

		await handleMarketplaceRefresh(interaction, watch);

		expect(extendWatch).toHaveBeenCalledWith(watch);
		expect(updatePayload(interaction).content).toBe(
			messageCopy.yourWatchHasBeenExtended,
		);
	});

	it('lists an unlisted watch, and the re-rendered footer says it is now listed', async () => {
		const interaction = makeButtonInteraction();

		await handleMarketplaceListedInactive(interaction, watch);

		expect(setWatchListed).toHaveBeenCalledWith(1, true);
		expect(actionTypes(interaction)[3]).toBe('MarketplaceListedActive');
		expect(updatePayload(interaction).content).toBe(
			messageCopy.yourWatchIsNowListed,
		);
		expect(
			updatePayload(interaction).embeds[0].toJSON().footer?.text,
		).toContain(
			'Listed: traders with a matching watch can see and contact you',
		);
	});

	it('unlists a listed watch, and the re-rendered digest stops showing traders', async () => {
		vi.mocked(getMarketplaceViewForWatch).mockResolvedValue({
			watch: makeWatchWithUser({ id: 1, isPublicallyTradeable: false }),
			counterparts: [],
		});
		const interaction = makeButtonInteraction();

		await handleMarketplaceListedActive(interaction, watch);

		expect(setWatchListed).toHaveBeenCalledWith(1, false);
		expect(actionTypes(interaction)[3]).toBe('MarketplaceListedInactive');
		const embed = updatePayload(interaction).embeds[0].toJSON();
		expect(embed.footer?.text).toContain(
			'Not listed: other traders cannot see this watch',
		);
	});

	it('clears the message instead of failing when the watch vanished mid-click', async () => {
		vi.mocked(getMarketplaceViewForWatch).mockResolvedValue(null);
		const interaction = makeButtonInteraction();

		await handleMarketplaceRefresh(interaction, watch);

		expect(interaction.update).toHaveBeenCalledWith({
			content: messageCopy.thisItemNoLongerExists,
			embeds: [],
			components: [],
		});
	});
});
