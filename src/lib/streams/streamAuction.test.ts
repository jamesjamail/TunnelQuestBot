import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));
vi.mock('../content/messages/messageBuilder', () => ({
	embeddedAuctionStreamMessageBuilder: vi.fn(async () => []),
}));

import { describe, it, expect } from 'vitest';
import { Server } from '@prisma/client';
import { streamAuctionToAllStreamChannels } from './streamAuction';
import { gracefullyHandleError } from '../helpers/errors';

describe('streamAuctionToAllStreamChannels', () => {
	it('reports embedded channel failures with the embedded channel id', async () => {
		await streamAuctionToAllStreamChannels(
			'Soandso',
			Server.BLUE,
			'WTS FBSS',
			{ buying: [], selling: [] },
		);

		const firstError = vi.mocked(gracefullyHandleError).mock.calls[0]?.[0];
		expect(firstError).toBeInstanceOf(Error);
		expect((firstError as Error).message).toContain('BLUE-embedded');
		expect((firstError as Error).message.toLowerCase()).toContain(
			'embedded',
		);
	});
});
