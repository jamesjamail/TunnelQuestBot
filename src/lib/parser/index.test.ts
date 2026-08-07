import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));
vi.mock('../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

const {
	getWatchesGroupedByServer,
	deleteWatchesOlderThanWatchdurationDays,
	runPlayerLinkHousekeeping,
	removeNoncommandMessagesFromPublicCommandSpace,
	monitorLogFile,
} = vi.hoisted(() => ({
	getWatchesGroupedByServer: vi.fn(async () => ({})),
	deleteWatchesOlderThanWatchdurationDays: vi.fn(async () => undefined),
	runPlayerLinkHousekeeping: vi.fn(async () => undefined),
	removeNoncommandMessagesFromPublicCommandSpace: vi.fn(
		async () => undefined,
	),
	monitorLogFile: vi.fn(),
}));

vi.mock('../../prisma/dbExecutors/watch', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../prisma/dbExecutors/watch')>();
	return {
		...actual,
		getWatchesGroupedByServer,
		deleteWatchesOlderThanWatchdurationDays,
	};
});
vi.mock('../../prisma/dbExecutors/playerLink', () => ({
	runPlayerLinkHousekeeping,
}));
vi.mock('../helpers/removeMessagesFromCommandSpace', () => ({
	removeNoncommandMessagesFromPublicCommandSpace,
}));
vi.mock('./monitorLogs', () => ({
	monitorLogFile,
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gracefullyHandleError } from '../helpers/errors';
import { startLoggingAllServers } from './index';

describe('startLoggingAllServers', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		getWatchesGroupedByServer.mockClear();
		deleteWatchesOlderThanWatchdurationDays.mockClear();
		runPlayerLinkHousekeeping.mockClear();
		removeNoncommandMessagesFromPublicCommandSpace.mockClear();
		monitorLogFile.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('schedules polling intervals at the expected periods', async () => {
		const setIntervalSpy = vi.spyOn(global, 'setInterval');

		await startLoggingAllServers();

		const intervals = setIntervalSpy.mock.calls.map((call) => call[1]);
		expect(intervals.filter((ms) => ms === 60_000)).toHaveLength(3);
		expect(intervals.filter((ms) => ms === 10_000)).toHaveLength(1);
	});

	it('keeps later ticks running when one callback throws', async () => {
		getWatchesGroupedByServer
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new Error('tick failed'))
			.mockResolvedValue({});

		await startLoggingAllServers();

		await vi.advanceTimersByTimeAsync(60_000);
		await vi.advanceTimersByTimeAsync(60_000);

		expect(
			getWatchesGroupedByServer.mock.calls.length,
		).toBeGreaterThanOrEqual(3);
		expect(gracefullyHandleError).toHaveBeenCalled();
	});

	it('does not clear intervals on teardown (no teardown path exists)', async () => {
		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

		await startLoggingAllServers();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(clearIntervalSpy).not.toHaveBeenCalled();
	});
});
