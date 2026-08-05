import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));

import { describe, it, expect, beforeEach } from 'vitest';
import { gracefullyHandleError } from './errors';
import { client, makeTextChannelStub } from '../../test/mocks/discordClient';

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
});
