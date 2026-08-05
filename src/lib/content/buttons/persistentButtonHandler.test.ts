import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));

import { describe, it, expect } from 'vitest';
import { ButtonInteraction } from 'discord.js';
import { extractNotificationContext } from './persistentButtonHandler';

describe('extractNotificationContext', () => {
	it('parses suffixed prices like 3.5k into numeric platinum values', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'\n\n\n**Soandso** is currently selling **Fbss** for **3.5k** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 3.5k``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction)).toEqual({
			player: 'Soandso',
			price: 3500,
			auctionMessage: 'WTS FBSS 3.5k',
		});
	});

	it('parses plain pp prices', () => {
		const interaction = {
			message: {
				embeds: [
					{
						description:
							'**Soandso** is currently selling **Fbss** for **500pp** on **Project 1999 Blue Server**\n\n``Soandso auctions, WTS FBSS 500pp``',
					},
				],
			},
		} as unknown as ButtonInteraction;

		expect(extractNotificationContext(interaction).price).toBe(500);
	});
});
