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
	marketplaceMatchBuilder: vi.fn(() => ({ data: { title: 'match' } })),
}));
vi.mock('../content/buttons/buttonRowBuilder', () => ({
	buttonRowBuilder: vi.fn(() => []),
	MessageTypes: { watch: 'watch' },
}));

const {
	matchNewWatchToMarketplace,
	sweepMarketplaceMatches,
	getUnnotifiedMarketplaceMatches,
	claimMarketplaceMatchNotification,
	releaseMarketplaceMatchNotificationClaim,
	isWatchStillEligible,
} = vi.hoisted(() => ({
	matchNewWatchToMarketplace: vi.fn(async () => []),
	sweepMarketplaceMatches: vi.fn(async () => []),
	getUnnotifiedMarketplaceMatches: vi.fn(async () => []),
	claimMarketplaceMatchNotification: vi.fn(async () => true),
	releaseMarketplaceMatchNotificationClaim: vi.fn(async () => undefined),
	isWatchStillEligible: vi.fn(async () => true),
}));
vi.mock('../../prisma/dbExecutors/marketplace', () => ({
	matchNewWatchToMarketplace,
	sweepMarketplaceMatches,
	getUnnotifiedMarketplaceMatches,
	claimMarketplaceMatchNotification,
	releaseMarketplaceMatchNotificationClaim,
	isWatchStillEligible,
}));

import { describe, it, expect, beforeEach } from 'vitest';
import {
	checkForMarketplaceMatches,
	notifyMarketplaceMatches,
	runMarketplaceMatchingSweep,
} from './marketplaceMatching';
import { client } from '../../test/mocks/discordClient';
import { gracefullyHandleError } from '../helpers/errors';
import {
	makeMarketplaceMatchWithWatches,
	makeWatch,
} from '../../test/factories';

describe('notifyMarketplaceMatches', () => {
	beforeEach(() => {
		vi.mocked(client.users.send)
			.mockReset()
			.mockResolvedValue({} as never);
		claimMarketplaceMatchNotification.mockReset().mockResolvedValue(true);
		releaseMarketplaceMatchNotificationClaim.mockClear();
		isWatchStillEligible.mockReset().mockResolvedValue(true);
		vi.mocked(gracefullyHandleError).mockClear();
	});

	it('sends a DM to both sides of a fresh match', async () => {
		const match = makeMarketplaceMatchWithWatches();

		await notifyMarketplaceMatches([match]);

		expect(client.users.send).toHaveBeenCalledTimes(2);
		expect(client.users.send).toHaveBeenCalledWith(
			match.wtbWatch.discordUserId,
			expect.anything(),
		);
		expect(client.users.send).toHaveBeenCalledWith(
			match.wtsWatch.discordUserId,
			expect.anything(),
		);
	});

	it('skips a side that was already notified, without claiming it', async () => {
		const match = makeMarketplaceMatchWithWatches({
			wtbNotifiedAt: new Date(),
		});

		await notifyMarketplaceMatches([match]);

		expect(claimMarketplaceMatchNotification).toHaveBeenCalledTimes(1);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			match.id,
			'wts',
		);
		expect(client.users.send).toHaveBeenCalledTimes(1);
	});

	it('does not send when the claim is lost to a concurrent caller', async () => {
		claimMarketplaceMatchNotification.mockResolvedValue(false);
		const match = makeMarketplaceMatchWithWatches();

		await notifyMarketplaceMatches([match]);

		expect(client.users.send).not.toHaveBeenCalled();
	});

	it('does not claim or send when the watch is no longer eligible', async () => {
		const match = makeMarketplaceMatchWithWatches();
		isWatchStillEligible.mockImplementation(
			async (watchId: number) => watchId !== match.wtbWatch.id,
		);

		await notifyMarketplaceMatches([match]);

		expect(claimMarketplaceMatchNotification).toHaveBeenCalledTimes(1);
		expect(claimMarketplaceMatchNotification).toHaveBeenCalledWith(
			match.id,
			'wts',
		);
		expect(client.users.send).toHaveBeenCalledTimes(1);
		expect(client.users.send).toHaveBeenCalledWith(
			match.wtsWatch.discordUserId,
			expect.anything(),
		);
	});

	it('releases the claim and reports the error on a non-closed-DM failure', async () => {
		vi.mocked(client.users.send).mockRejectedValue(new Error('cannot DM'));
		const match = makeMarketplaceMatchWithWatches();

		await notifyMarketplaceMatches([match]);

		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			match.id,
			'wtb',
		);
		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			match.id,
			'wts',
		);
		expect(gracefullyHandleError).toHaveBeenCalled();
	});

	it('keeps the claim on a closed-DM error', async () => {
		vi.mocked(client.users.send).mockRejectedValue({ code: 50007 });
		const match = makeMarketplaceMatchWithWatches();

		await notifyMarketplaceMatches([match]);

		expect(releaseMarketplaceMatchNotificationClaim).not.toHaveBeenCalled();
		expect(gracefullyHandleError).toHaveBeenCalled();
	});

	it('notifies the other side even when one side fails to send', async () => {
		const match = makeMarketplaceMatchWithWatches();
		vi.mocked(client.users.send).mockImplementation(
			async (discordUserId: string) => {
				if (discordUserId === match.wtbWatch.discordUserId) {
					throw new Error('cannot DM');
				}
				return {} as never;
			},
		);

		await notifyMarketplaceMatches([match]);

		expect(client.users.send).toHaveBeenCalledTimes(2);
		expect(releaseMarketplaceMatchNotificationClaim).toHaveBeenCalledWith(
			match.id,
			'wtb',
		);
		expect(
			releaseMarketplaceMatchNotificationClaim,
		).not.toHaveBeenCalledWith(match.id, 'wts');
	});
});

describe('checkForMarketplaceMatches', () => {
	beforeEach(() => {
		matchNewWatchToMarketplace.mockReset();
		vi.mocked(client.users.send)
			.mockReset()
			.mockResolvedValue({} as never);
		claimMarketplaceMatchNotification.mockReset().mockResolvedValue(true);
		isWatchStillEligible.mockReset().mockResolvedValue(true);
	});

	it('notifies only the matches created for the given watch', async () => {
		const watch = makeWatch({ id: 1 });
		const match = makeMarketplaceMatchWithWatches();
		matchNewWatchToMarketplace.mockResolvedValue([match]);

		await checkForMarketplaceMatches(watch);

		expect(matchNewWatchToMarketplace).toHaveBeenCalledWith(watch);
		expect(client.users.send).toHaveBeenCalledTimes(2);
	});

	it('does nothing further when no new matches are formed', async () => {
		matchNewWatchToMarketplace.mockResolvedValue([]);

		await checkForMarketplaceMatches(makeWatch());

		expect(client.users.send).not.toHaveBeenCalled();
	});
});

describe('runMarketplaceMatchingSweep', () => {
	beforeEach(() => {
		sweepMarketplaceMatches.mockReset().mockResolvedValue([]);
		getUnnotifiedMarketplaceMatches.mockReset().mockResolvedValue([]);
		vi.mocked(client.users.send)
			.mockReset()
			.mockResolvedValue({} as never);
		claimMarketplaceMatchNotification.mockReset().mockResolvedValue(true);
		isWatchStillEligible.mockReset().mockResolvedValue(true);
	});

	it('sweeps for new pairings, then notifies every pending match', async () => {
		const match = makeMarketplaceMatchWithWatches();
		getUnnotifiedMarketplaceMatches.mockResolvedValue([match]);

		await runMarketplaceMatchingSweep();

		expect(sweepMarketplaceMatches).toHaveBeenCalled();
		expect(getUnnotifiedMarketplaceMatches).toHaveBeenCalled();
		expect(client.users.send).toHaveBeenCalledTimes(2);
	});
});
