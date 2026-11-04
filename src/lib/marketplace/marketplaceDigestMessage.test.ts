import { vi } from 'vitest';
vi.mock('../../index', () => import('../../test/mocks/discordClient'));
vi.mock('../../prisma/init', () => import('../../test/mocks/prisma'));
vi.mock('../../redis/init', () => import('../../test/mocks/redis'));

import { describe, it, expect } from 'vitest';
import { buildMarketplaceDigestMessage } from './marketplaceDigestMessage';
import { makeWatchWithUser } from '../../test/factories';

function buttons(message: ReturnType<typeof buildMarketplaceDigestMessage>) {
	return message.components[0].components.map(
		(button) => button.toJSON().custom_id,
	);
}

describe('buildMarketplaceDigestMessage', () => {
	it('returns the digest embed with a button row keyed to the watch', () => {
		const message = buildMarketplaceDigestMessage(
			makeWatchWithUser({ id: 7 }),
			[],
			'heading',
		);

		expect(message.embeds).toHaveLength(1);
		expect(buttons(message)).toEqual([
			'MarketplaceSnoozeInactive:7',
			'MarketplaceUnwatchInactive:7',
			'MarketplaceRefreshInactive:7',
			'MarketplaceListedActive:7',
		]);
	});

	it.each([
		[
			'snoozed',
			{ snoozedUntil: new Date(Date.now() + 60 * 60 * 1000) },
			'MarketplaceSnoozeActive:7',
			0,
		],
		['ended', { active: false }, 'MarketplaceUnwatchActive:7', 1],
		[
			'unlisted',
			{ isPublicallyTradeable: false },
			'MarketplaceListedInactive:7',
			3,
		],
	])(
		'reads the %s state off the watch',
		(_name, overrides, expected, index) => {
			const message = buildMarketplaceDigestMessage(
				makeWatchWithUser({ id: 7, ...overrides }),
				[],
				'heading',
			);

			expect(buttons(message)[index]).toBe(expected);
		},
	);
});
