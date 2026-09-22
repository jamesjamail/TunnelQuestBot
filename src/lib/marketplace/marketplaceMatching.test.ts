import { vi } from 'vitest';
vi.mock('../..', () => import('../../test/mocks/discordClient'));
vi.mock('../helpers/errors', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../helpers/errors')>();
	return {
		...actual,
		gracefullyHandleError: vi.fn(async () => undefined),
	};
});
vi.mock('../content/messages/messageBuilder', () => ({
	marketplaceDigestBuilder: vi.fn(() => ({ data: { title: 'inline' } })),
}));
vi.mock('./marketplaceDigestMessage', () => ({
	buildMarketplaceDigestMessage: vi.fn(() => ({
		embeds: [{ data: { title: 'digest' } }],
		components: [],
	})),
}));

const {
	getMarketplaceViewForWatch,
	getWatchIdsWithPendingMarketplaceMatches,
	matchNewWatchToMarketplace,
	sweepMarketplaceMatches,
	claimMarketplaceMatchNotification,
	releaseMarketplaceMatchNotificationClaim,
	filterOutRecentlyNotified,
	recordMarketplaceNotifications,
} = vi.hoisted(() => ({
	getMarketplaceViewForWatch: vi.fn(),
	getWatchIdsWithPendingMarketplaceMatches: vi.fn(async () => []),
	matchNewWatchToMarketplace: vi.fn(async () => []),
	sweepMarketplaceMatches: vi.fn(async () => []),
	claimMarketplaceMatchNotification: vi.fn(async () => true),
	releaseMarketplaceMatchNotificationClaim: vi.fn(async () => undefined),
	// 	a no-op pass-through by default, so tests unrelated to the throttle
	// 	are unaffected
	filterOutRecentlyNotified: vi.fn(
		async (
			_recipientDiscordUserId: string,
			_itemName: string,
			_server: string,
			counterparts: unknown[],
		) => counterparts,
	),
	recordMarketplaceNotifications: vi.fn(async () => undefined),
}));
vi.mock('../../prisma/dbExecutors/marketplace', () => ({
	getMarketplaceViewForWatch,
	getWatchIdsWithPendingMarketplaceMatches,
	matchNewWatchToMarketplace,
	sweepMarketplaceMatches,
	claimMarketplaceMatchNotification,
	releaseMarketplaceMatchNotificationClaim,
	filterOutRecentlyNotified,
	recordMarketplaceNotifications,
}));

import { describe, it, expect, beforeEach } from 'vitest';
import type {
	MarketplaceCounterpart,
	MarketplaceWatchView,
} from '../../prisma/dbExecutors/marketplace';
import {
	buildMarketplacePreview,
	commitMarketplacePreview,
	runMarketplaceMatchingSweep,
} from './marketplaceMatching';
import { buildMarketplaceDigestMessage } from './marketplaceDigestMessage';
import { marketplaceDigestBuilder } from '../content/messages/messageBuilder';
import { client } from '../../test/mocks/discordClient';
import { gracefullyHandleError } from '../helpers/errors';
import { makeWatch, makeWatchWithUser } from '../../test/factories';
import { Server, WatchType } from '../../prisma/client';

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);

function makeCounterpart(
	matchId: number,
	overrides: Partial<MarketplaceCounterpart> = {},
): MarketplaceCounterpart {
	return {
		matchId,
		side: 'wtb',
		notified: false,
		watch: makeWatchWithUser(
			{
				id: 100 + matchId,
				discordUserId: '200',
				watchType: WatchType.WTS,
			},
			{ discordUserId: '200' },
		),
		...overrides,
	};
}

function makeView(
	counterparts: MarketplaceCounterpart[],
	watchOverrides: Parameters<typeof makeWatchWithUser>[0] = {},
	userOverrides: Parameters<typeof makeWatchWithUser>[1] = {},
): MarketplaceWatchView {
	return {
		watch: makeWatchWithUser(
			{ id: 1, watchType: WatchType.WTB, ...watchOverrides },
			userOverrides,
		),
		counterparts,
	};
}

function resetMocks() {
	vi.mocked(client.users.send)
		.mockReset()
		.mockResolvedValue({} as never);
	getMarketplaceViewForWatch.mockReset();
	getWatchIdsWithPendingMarketplaceMatches.mockReset().mockResolvedValue([]);
	matchNewWatchToMarketplace.mockReset().mockResolvedValue([]);
	sweepMarketplaceMatches.mockReset().mockResolvedValue([]);
	claimMarketplaceMatchNotification.mockReset().mockResolvedValue(true);
	releaseMarketplaceMatchNotificationClaim
		.mockReset()
		.mockResolvedValue(undefined);
	filterOutRecentlyNotified
		.mockReset()
		.mockImplementation(async (_r, _i, _s, counterparts) => counterparts);
	recordMarketplaceNotifications.mockReset().mockResolvedValue(undefined);
	vi.mocked(gracefullyHandleError).mockClear();
	vi.mocked(buildMarketplaceDigestMessage).mockClear();
	vi.mocked(marketplaceDigestBuilder).mockClear();
}

describe('runMarketplaceMatchingSweep', () => {
	beforeEach(() => {
		resetMocks();
		getWatchIdsWithPendingMarketplaceMatches.mockResolvedValue([1]);
	});

	it('sweeps for new pairings before digesting', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(makeView([]));

		await runMarketplaceMatchingSweep();

		expect(
			sweepMarketplaceMatches.mock.invocationCallOrder[0],
		).toBeLessThan(
			getWatchIdsWithPendingMarketplaceMatches.mock
				.invocationCallOrder[0],
		);
	});

	it('sends one DM per watch, however many counterparts it gained', async () => {
		const counterparts = [1, 2, 3, 4].map((id) => makeCounterpart(id));
		getMarketplaceViewForWatch.mockResolvedValue(makeView(counterparts));

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(1);
		expect(client.users.send).toHaveBeenCalledWith(
			'100',
			expect.objectContaining({ embeds: expect.any(Array) }),
		);
		expect(buildMarketplaceDigestMessage).toHaveBeenCalledWith(
			expect.objectContaining({ id: 1 }),
			counterparts,
			expect.any(String),
		);
	});

	it('claims every pending counterpart individually, on its own side', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([
				makeCounterpart(1, { side: 'wtb' }),
				makeCounterpart(2, { side: 'wts' }),
			]),
		);

		await runMarketplaceMatchingSweep();

		expect(claimMarketplaceMatchNotification).toHaveBeenCalledTimes(2);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			1,
			'wtb',
		);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			2,
			'wts',
		);
	});

	it('digests one DM per pending watch', async () => {
		getWatchIdsWithPendingMarketplaceMatches.mockResolvedValue([1, 5]);
		getMarketplaceViewForWatch.mockImplementation(async (id: number) =>
			makeView([makeCounterpart(id)], { id }),
		);

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(2);
	});

	it('leaves out a counterpart that was already notified, without claiming it', async () => {
		const fresh = makeCounterpart(2);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1, { notified: true }), fresh]),
		);

		await runMarketplaceMatchingSweep();

		expect(claimMarketplaceMatchNotification).toHaveBeenCalledTimes(1);
		expect(buildMarketplaceDigestMessage).toHaveBeenCalledWith(
			expect.anything(),
			[fresh],
			expect.any(String),
		);
	});

	it('sends nothing when everything was already notified', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1, { notified: true })]),
		);

		await runMarketplaceMatchingSweep();

		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
		expect(client.users.send).not.toHaveBeenCalled();
	});

	it('digests only what it won the claim for when a concurrent caller took some', async () => {
		const mine = makeCounterpart(1);
		claimMarketplaceMatchNotification
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([mine, makeCounterpart(2)]),
		);

		await runMarketplaceMatchingSweep();

		expect(buildMarketplaceDigestMessage).toHaveBeenCalledWith(
			expect.anything(),
			[mine],
			expect.any(String),
		);
	});

	it('does not send when the claim is lost on every counterpart', async () => {
		claimMarketplaceMatchNotification.mockResolvedValue(false);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await runMarketplaceMatchingSweep();

		expect(client.users.send).not.toHaveBeenCalled();
	});

	it('does nothing when the watch is gone', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(null);

		await runMarketplaceMatchingSweep();

		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
		expect(client.users.send).not.toHaveBeenCalled();
	});

	it.each([
		['ended', { active: false }, {}],
		['unlisted', { isPublicallyTradeable: false }, {}],
		['snoozed', { snoozedUntil: inOneHour() }, {}],
		['owned by a globally snoozed user', {}, { snoozedUntil: inOneHour() }],
	])(
		'holds back the DM, and leaves matches unclaimed, for a watch that is %s',
		async (_name, watchOverrides, userOverrides) => {
			getMarketplaceViewForWatch.mockResolvedValue(
				makeView([makeCounterpart(1)], watchOverrides, userOverrides),
			);

			await runMarketplaceMatchingSweep();

			expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
			expect(client.users.send).not.toHaveBeenCalled();
		},
	);

	it('sends the whole backlog in one digest once a snooze has lapsed', async () => {
		const backlog = [1, 2, 3].map((id) => makeCounterpart(id));
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView(
				backlog,
				{ snoozedUntil: new Date(Date.now() - 1000) },
				{ snoozedUntil: new Date(Date.now() - 1000) },
			),
		);

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(1);
		expect(buildMarketplaceDigestMessage).toHaveBeenCalledWith(
			expect.anything(),
			backlog,
			expect.any(String),
		);
	});

	it('releases every claim and reports the error on a non-closed-DM failure', async () => {
		const error = new Error('cannot DM');
		vi.mocked(client.users.send).mockRejectedValue(error);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([
				makeCounterpart(1, { side: 'wtb' }),
				makeCounterpart(2, { side: 'wts' }),
			]),
		);

		await runMarketplaceMatchingSweep();

		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			1,
			'wtb',
		);
		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			2,
			'wts',
		);
		expect(gracefullyHandleError).toHaveBeenCalledWith(
			error,
			undefined,
			undefined,
			{ watchId: 1, matchIds: [1, 2] },
		);
	});

	it('still reports the send error, and releases the rest, when a release fails', async () => {
		const sendError = new Error('cannot DM');
		vi.mocked(client.users.send).mockRejectedValue(sendError);
		// 	the first match row was deleted mid-send (P2025)
		releaseMarketplaceMatchNotificationClaim.mockRejectedValueOnce(
			new Error('P2025'),
		);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1), makeCounterpart(2)]),
		);

		await runMarketplaceMatchingSweep();

		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledTimes(
			2,
		);
		expect(gracefullyHandleError).toHaveBeenCalledWith(
			sendError,
			undefined,
			undefined,
			expect.objectContaining({ watchId: 1 }),
		);
	});

	it('keeps the claims on a closed-DM error', async () => {
		vi.mocked(client.users.send).mockRejectedValue({ code: 50007 });
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await runMarketplaceMatchingSweep();

		expect(releaseMarketplaceMatchNotificationClaim).not.toHaveBeenCalled();
		expect(gracefullyHandleError).toHaveBeenCalled();
	});

	it('digests the other watches even when one fails to send', async () => {
		getWatchIdsWithPendingMarketplaceMatches.mockResolvedValue([1, 5]);
		getMarketplaceViewForWatch.mockImplementation(async (id: number) =>
			makeView([makeCounterpart(id)], { id, discordUserId: `${id}00` }),
		);
		vi.mocked(client.users.send)
			.mockRejectedValueOnce(new Error('cannot DM'))
			.mockResolvedValueOnce({} as never);

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(2);
		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledTimes(
			1,
		);
	});

	it('reports an unexpected failure reading a watch and carries on', async () => {
		getWatchIdsWithPendingMarketplaceMatches.mockResolvedValue([1, 5]);
		getMarketplaceViewForWatch
			.mockRejectedValueOnce(new Error('db down'))
			.mockResolvedValueOnce(makeView([makeCounterpart(1)], { id: 5 }));

		await runMarketplaceMatchingSweep();

		expect(gracefullyHandleError).toHaveBeenCalledWith(expect.any(Error));
		expect(client.users.send).toHaveBeenCalledTimes(1);
	});

	it('asks the throttle only about unnotified counterparts, keyed on the recipient watch', async () => {
		const watch = makeView(
			[makeCounterpart(1, { notified: true }), makeCounterpart(2)],
			{ id: 1, itemName: 'SASH', server: Server.GREEN },
			{ discordUserId: '100' },
		);
		getMarketplaceViewForWatch.mockResolvedValue(watch);

		await runMarketplaceMatchingSweep();

		expect(filterOutRecentlyNotified).toHaveBeenCalledWith(
			'100',
			'SASH',
			Server.GREEN,
			[watch.counterparts[1]],
		);
	});

	it('does not claim, or DM, a counterpart the throttle holds back', async () => {
		filterOutRecentlyNotified.mockResolvedValue([]);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await runMarketplaceMatchingSweep();

		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
		expect(client.users.send).not.toHaveBeenCalled();
	});

	it('records a notification history entry for every counterpart it actually sent', async () => {
		const counterparts = [makeCounterpart(1), makeCounterpart(2)];
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView(counterparts, { itemName: 'SASH', server: Server.GREEN }),
		);

		await runMarketplaceMatchingSweep();

		expect(recordMarketplaceNotifications).toHaveBeenCalledWith(
			'100',
			'SASH',
			Server.GREEN,
			counterparts,
		);
	});

	it('reports, but does not release claims for, a failure recording notification history after a successful send', async () => {
		const recordError = new Error('db down');
		recordMarketplaceNotifications.mockRejectedValue(recordError);
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await runMarketplaceMatchingSweep();

		expect(client.users.send).toHaveBeenCalledTimes(1);
		expect(releaseMarketplaceMatchNotificationClaim).not.toHaveBeenCalled();
		expect(gracefullyHandleError).toHaveBeenCalledWith(
			recordError,
			undefined,
			undefined,
			expect.objectContaining({
				watchId: 1,
				phase: 'marketplaceNotificationHistory',
			}),
		);
	});

	it('does not record notification history when the send itself fails', async () => {
		vi.mocked(client.users.send).mockRejectedValue(new Error('cannot DM'));
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await runMarketplaceMatchingSweep();

		expect(recordMarketplaceNotifications).not.toHaveBeenCalled();
	});
});

describe('buildMarketplacePreview', () => {
	beforeEach(resetMocks);

	it('records pairings for the given watch, then reads what it can now see', async () => {
		const watch = makeWatch({ id: 1 });
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);

		await buildMarketplacePreview(watch);

		expect(matchNewWatchToMarketplace).toHaveBeenCalledWith(watch);
		expect(getMarketplaceViewForWatch).toHaveBeenCalledWith(1);
		expect(
			matchNewWatchToMarketplace.mock.invocationCallOrder[0],
		).toBeLessThan(getMarketplaceViewForWatch.mock.invocationCallOrder[0]);
	});

	it('never DMs: the matches come back as an embed for the reply', async () => {
		const counterparts = [1, 2, 3].map((id) => makeCounterpart(id));
		getMarketplaceViewForWatch.mockResolvedValue(makeView(counterparts));

		const preview = await buildMarketplacePreview(makeWatch({ id: 1 }));

		expect(client.users.send).not.toHaveBeenCalled();
		expect(preview?.embed).toBeDefined();
		expect(marketplaceDigestBuilder).toHaveBeenCalledWith(
			expect.objectContaining({ id: 1 }),
			counterparts,
			expect.any(String),
		);
	});

	it('does not claim anything by itself - only building the embed', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1), makeCounterpart(2, { side: 'wts' })]),
		);

		await buildMarketplacePreview(makeWatch({ id: 1 }));

		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
	});

	it('collects only the unnotified counterparts as claimable', async () => {
		const notified = makeCounterpart(1, { notified: true });
		const fresh = makeCounterpart(2, { side: 'wts' });
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([notified, fresh]),
		);

		const preview = await buildMarketplacePreview(makeWatch({ id: 1 }));

		expect(preview?.claimable).toEqual([fresh]);
	});

	it('shows already-notified matches too, since the reply is a full picture', async () => {
		const seen = makeCounterpart(1, { notified: true });
		getMarketplaceViewForWatch.mockResolvedValue(makeView([seen]));

		await buildMarketplacePreview(makeWatch({ id: 1 }));

		expect(marketplaceDigestBuilder).toHaveBeenCalledWith(
			expect.anything(),
			[seen],
			expect.any(String),
		);
	});

	it('still builds a preview, with nothing claimable, when there are no counterparts', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(makeView([]));

		const preview = await buildMarketplacePreview(makeWatch());

		expect(preview).toBeDefined();
		expect(preview?.claimable).toEqual([]);
		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
	});

	it('returns nothing when the watch is gone', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(null);

		expect(await buildMarketplacePreview(makeWatch())).toBeUndefined();
	});

	it('does not swallow a matching failure, and claims nothing', async () => {
		matchNewWatchToMarketplace.mockRejectedValue(new Error('db down'));

		await expect(buildMarketplacePreview(makeWatch())).rejects.toThrow(
			'db down',
		);
		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
	});

	it('does not swallow a rendering failure, and claims nothing', async () => {
		getMarketplaceViewForWatch.mockResolvedValue(
			makeView([makeCounterpart(1)]),
		);
		vi.mocked(marketplaceDigestBuilder).mockImplementationOnce(() => {
			throw new Error('title too long');
		});

		await expect(buildMarketplacePreview(makeWatch())).rejects.toThrow(
			'title too long',
		);
		expect(claimMarketplaceMatchNotification).not.toHaveBeenCalled();
	});
});

describe('commitMarketplacePreview', () => {
	beforeEach(resetMocks);

	it('claims every claimable counterpart, on its own side', async () => {
		const preview = {
			embed: {} as never,
			claimable: [
				makeCounterpart(1, { side: 'wtb' }),
				makeCounterpart(2, { side: 'wts' }),
			],
		};

		await commitMarketplacePreview(preview);

		expect(claimMarketplaceMatchNotification).toHaveBeenCalledTimes(2);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			1,
			'wtb',
		);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			2,
			'wts',
		);
	});

	it('skips a counterpart a concurrent sweep already claimed, without releasing anything', async () => {
		claimMarketplaceMatchNotification
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false);
		const preview = {
			embed: {} as never,
			claimable: [makeCounterpart(1), makeCounterpart(2)],
		};

		await commitMarketplacePreview(preview);

		expect(releaseMarketplaceMatchNotificationClaim).not.toHaveBeenCalled();
	});

	it('releases whatever it already claimed, then rethrows, if a later claim fails', async () => {
		claimMarketplaceMatchNotification
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error('db down'));
		const preview = {
			embed: {} as never,
			claimable: [
				makeCounterpart(1, { side: 'wtb' }),
				makeCounterpart(2, { side: 'wts' }),
			],
		};

		await expect(commitMarketplacePreview(preview)).rejects.toThrow(
			'db down',
		);

		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledTimes(
			1,
		);
		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			1,
			'wtb',
		);
	});
});
