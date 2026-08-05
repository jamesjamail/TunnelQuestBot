import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gracefullyHandleError } from './errors';
import { client, makeTextChannelStub } from '../../test/mocks/discordClient';

async function loadErrorsModule() {
	vi.resetModules();
	vi.doMock('../../index', () => import('../../test/mocks/discordClient'));
	const [errors, discord] = await Promise.all([
		import('./errors'),
		import('../../test/mocks/discordClient'),
	]);
	return { ...errors, client: discord.client };
}

describe('gracefullyHandleError', () => {
	beforeEach(() => {
		const channelStub = makeTextChannelStub();
		vi.mocked(client.channels.fetch).mockResolvedValue(
			channelStub as never,
		);
	});

	it('truncates Discord error reports to 2000 characters', async () => {
		await gracefullyHandleError(
			new Error(`unique-${Date.now()}-${'x'.repeat(5000)}`),
		);

		const channelStub = await client.channels.fetch('999000999');
		const sendMock = (channelStub as ReturnType<typeof makeTextChannelStub>)
			.send;
		for (const call of sendMock.mock.calls) {
			for (const arg of call) {
				if (typeof arg === 'string') {
					expect(arg.length).toBeLessThanOrEqual(2000);
				}
			}
		}
	});

	it('posts to the error channel on the background path with no interaction', async () => {
		await gracefullyHandleError(new Error(`background-${Date.now()}`));

		const channelStub = await client.channels.fetch('999000999');
		expect(
			(channelStub as ReturnType<typeof makeTextChannelStub>).send,
		).toHaveBeenCalled();
	});

	it('includes interaction context in the report when an interaction is provided', async () => {
		const interaction = {
			user: { id: '555' },
		};

		await gracefullyHandleError(
			new Error(`interaction-${Date.now()}`),
			interaction as never,
		);

		const channelStub = await client.channels.fetch('999000999');
		const message = vi.mocked(
			(channelStub as ReturnType<typeof makeTextChannelStub>).send,
		).mock.calls[0]?.[0] as string;
		expect(message).toContain('<@555>');
	});

	it('degrades to console logging when ERROR_LOG_CHANNEL_ID is missing', async () => {
		const original = process.env.ERROR_LOG_CHANNEL_ID;
		delete process.env.ERROR_LOG_CHANNEL_ID;
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);

		await expect(
			gracefullyHandleError(new Error(`missing-channel-${Date.now()}`)),
		).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalled();
		process.env.ERROR_LOG_CHANNEL_ID = original;
		consoleError.mockRestore();
	});

	it('does not recurse infinitely when reporting an error throws', async () => {
		const channelStub = makeTextChannelStub();
		vi.mocked(channelStub.send).mockRejectedValue(new Error('send failed'));
		vi.mocked(client.channels.fetch).mockResolvedValue(
			channelStub as never,
		);
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);

		await expect(
			gracefullyHandleError(new Error(`report-failure-${Date.now()}`)),
		).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledWith(
			'ERROR LOGGING ERROR TO DISCORD: ',
			expect.any(Error),
		);
		consoleError.mockRestore();
	});
});

describe('error report throttling', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
	});

	afterEach(async () => {
		vi.useRealTimers();
		await loadErrorsModule();
	});

	async function getSendCount(activeClient = client) {
		const channelStub = await activeClient.channels.fetch('999000999');
		return vi.mocked(
			(channelStub as ReturnType<typeof makeTextChannelStub>).send,
		).mock.calls.length;
	}

	it('posts the same error signature only once within the dedupe window', async () => {
		const { gracefullyHandleError: handleError, client: activeClient } =
			await loadErrorsModule();
		vi.mocked(activeClient.isReady).mockReturnValue(true);
		const channelStub = makeTextChannelStub();
		vi.mocked(activeClient.channels.fetch).mockResolvedValue(
			channelStub as never,
		);
		const error = new Error('dedupe-me');

		await handleError(error);
		await handleError(error);

		expect(await getSendCount(activeClient)).toBe(1);
	});

	it('posts the same signature again after the dedupe window expires', async () => {
		const { gracefullyHandleError: handleError, client: activeClient } =
			await loadErrorsModule();
		vi.mocked(activeClient.isReady).mockReturnValue(true);
		const channelStub = makeTextChannelStub();
		vi.mocked(activeClient.channels.fetch).mockResolvedValue(
			channelStub as never,
		);
		const error = new Error('dedupe-later');

		await handleError(error);
		vi.advanceTimersByTime(15 * 60 * 1000 + 1);
		await handleError(error);

		expect(await getSendCount(activeClient)).toBe(2);
	});

	it('posts two different signatures separately', async () => {
		const { gracefullyHandleError: handleError, client: activeClient } =
			await loadErrorsModule();
		vi.mocked(activeClient.isReady).mockReturnValue(true);
		const channelStub = makeTextChannelStub();
		vi.mocked(activeClient.channels.fetch).mockResolvedValue(
			channelStub as never,
		);

		await handleError(new Error('signature-a'));
		await handleError(new Error('signature-b'));

		expect(await getSendCount(activeClient)).toBe(2);
	});

	it('suppresses further posts once the per-minute rate limit is hit', async () => {
		const { gracefullyHandleError: handleError, client: activeClient } =
			await loadErrorsModule();
		vi.mocked(activeClient.isReady).mockReturnValue(true);
		const channelStub = makeTextChannelStub();
		vi.mocked(activeClient.channels.fetch).mockResolvedValue(
			channelStub as never,
		);
		const consoleWarn = vi
			.spyOn(console, 'warn')
			.mockImplementation(() => undefined);

		for (let index = 0; index < 12; index += 1) {
			await handleError(new Error(`rate-limit-${index}`));
		}

		expect(await getSendCount(activeClient)).toBe(10);
		expect(consoleWarn).toHaveBeenCalledWith(
			expect.stringContaining('suppressing further reports'),
		);
		consoleWarn.mockRestore();
	});

	it('allows posts again after the rate-limit window rolls over', async () => {
		const { gracefullyHandleError: handleError, client: activeClient } =
			await loadErrorsModule();
		vi.mocked(activeClient.isReady).mockReturnValue(true);
		const channelStub = makeTextChannelStub();
		vi.mocked(activeClient.channels.fetch).mockResolvedValue(
			channelStub as never,
		);

		for (let index = 0; index < 11; index += 1) {
			await handleError(new Error(`roll-window-${index}`));
		}
		const sendsBeforeRoll = await getSendCount(activeClient);

		vi.advanceTimersByTime(60 * 1000 + 1);
		await handleError(new Error('after-roll-window'));

		expect(await getSendCount(activeClient)).toBeGreaterThan(
			sendsBeforeRoll,
		);
	});
});
