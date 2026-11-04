import { vi } from 'vitest';
vi.mock('../../../index', () => import('../../../test/mocks/discordClient'));
vi.mock('../../../prisma/init', () => import('../../../test/mocks/prisma'));
vi.mock('../../../redis/init', () => import('../../../test/mocks/redis'));
vi.mock('../../../prisma/dbExecutors/block', () => ({
	getHiddenTraders: vi.fn(async () => []),
	hideTrader: vi.fn(async () => undefined),
	unhideTrader: vi.fn(async () => 0),
}));
vi.mock('../../../prisma/dbExecutors/user', () => ({
	findOrCreateUser: vi.fn(),
}));
vi.mock('../../../prisma/dbExecutors/marketplace', () => ({
	getMarketplaceViewsForUser: vi.fn(async () => []),
}));
vi.mock('../../content/messages/messageBuilder', () => ({
	marketplaceCommandResponseBuilder: vi.fn(() => ['embed']),
	packEmbedsForDiscord: vi.fn(() => [['embed']]),
}));
vi.mock('../../helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';
import command from './marketplace';
import {
	getHiddenTraders,
	hideTrader,
	unhideTrader,
} from '../../../prisma/dbExecutors/block';
import { findOrCreateUser } from '../../../prisma/dbExecutors/user';
import { getMarketplaceViewsForUser } from '../../../prisma/dbExecutors/marketplace';
import {
	marketplaceCommandResponseBuilder,
	packEmbedsForDiscord,
} from '../../content/messages/messageBuilder';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';
import {
	makeChatInteraction,
	makeUser,
	makeWatchWithUser,
} from '../../../test/factories';

const TRADER_ID = '123456789012345678';

function interactionWith(options: Record<string, unknown> = {}) {
	const interaction = makeChatInteraction();
	vi.mocked(interaction.options.get).mockImplementation((name: string) =>
		name in options ? ({ value: options[name] } as never) : null,
	);
	return interaction;
}

describe('marketplace command', () => {
	beforeEach(() => {
		vi.mocked(findOrCreateUser).mockReset().mockResolvedValue(makeUser());
		vi.mocked(getMarketplaceViewsForUser)
			.mockReset()
			.mockResolvedValue([
				{ watch: makeWatchWithUser(), counterparts: [] },
			]);
		vi.mocked(getHiddenTraders).mockReset().mockResolvedValue([]);
		vi.mocked(hideTrader).mockClear();
		vi.mocked(unhideTrader).mockReset().mockResolvedValue(0);
		vi.mocked(marketplaceCommandResponseBuilder).mockClear();
		vi.mocked(packEmbedsForDiscord)
			.mockReset()
			.mockReturnValue([['embed'] as never]);
		vi.mocked(gracefullyHandleError).mockClear();
	});

	it('defers ephemerally, since the reads can outlast the ack window', async () => {
		const interaction = interactionWith();

		await command.execute(interaction);

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		});
	});

	describe('with no options', () => {
		it("shows the caller's watches, their matches and their hidden traders", async () => {
			vi.mocked(getHiddenTraders).mockResolvedValue([
				{ hiddenDiscordUserId: '300', discordUsername: undefined },
			]);
			const interaction = interactionWith();

			await command.execute(interaction);

			expect(getMarketplaceViewsForUser).toHaveBeenCalledWith('100');
			expect(getHiddenTraders).toHaveBeenCalledWith('100');
			expect(marketplaceCommandResponseBuilder).toHaveBeenCalledWith(
				expect.any(Array),
				expect.objectContaining({ discordUserId: '100' }),
				['300'],
			);
			expect(interaction.editReply).toHaveBeenCalledWith({
				embeds: ['embed'],
			});
			expect(interaction.followUp).not.toHaveBeenCalled();
		});

		it('sends what does not fit in one message as ephemeral follow-ups', async () => {
			vi.mocked(packEmbedsForDiscord).mockReturnValue([
				['one'] as never,
				['two'] as never,
				['three'] as never,
			]);
			const interaction = interactionWith();

			await command.execute(interaction);

			expect(interaction.editReply).toHaveBeenCalledWith({
				embeds: ['one'],
			});
			expect(interaction.followUp).toHaveBeenCalledTimes(2);
			expect(interaction.followUp).toHaveBeenCalledWith({
				embeds: ['two'],
				flags: MessageFlags.Ephemeral,
			});
		});

		it('says so when the user has no watches', async () => {
			vi.mocked(getMarketplaceViewsForUser).mockResolvedValue([]);
			const interaction = interactionWith();

			await command.execute(interaction);

			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.youDontHaveAnyWatches,
			);
			expect(marketplaceCommandResponseBuilder).not.toHaveBeenCalled();
		});
	});

	describe('hide', () => {
		it('hides the chosen trader and does not list', async () => {
			const interaction = interactionWith({ hide: TRADER_ID });

			await command.execute(interaction);

			expect(hideTrader).toHaveBeenCalledWith('100', TRADER_ID);
			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.traderHasBeenHidden(TRADER_ID),
			);
			expect(getMarketplaceViewsForUser).not.toHaveBeenCalled();
		});

		it('rejects a name that was typed rather than picked from the suggestions', async () => {
			const interaction = interactionWith({ hide: 'Ogrelord' });

			await command.execute(interaction);

			expect(hideTrader).not.toHaveBeenCalled();
			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.pickATraderFromTheSuggestions,
			);
		});

		it('refuses to hide yourself', async () => {
			vi.mocked(findOrCreateUser).mockResolvedValue(
				makeUser({ discordUserId: TRADER_ID }),
			);
			const interaction = interactionWith({ hide: TRADER_ID });

			await command.execute(interaction);

			expect(hideTrader).not.toHaveBeenCalled();
			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.youCantHideYourself,
			);
		});
	});

	describe('unhide', () => {
		it('unhides a hidden trader', async () => {
			vi.mocked(unhideTrader).mockResolvedValue(1);
			const interaction = interactionWith({ unhide: TRADER_ID });

			await command.execute(interaction);

			expect(unhideTrader).toHaveBeenCalledWith('100', TRADER_ID);
			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.traderHasBeenUnhidden(TRADER_ID),
			);
		});

		it('says so when the trader was not hidden', async () => {
			const interaction = interactionWith({ unhide: TRADER_ID });

			await command.execute(interaction);

			expect(interaction.editReply).toHaveBeenCalledWith(
				messageCopy.traderWasNotHidden(TRADER_ID),
			);
		});

		it('rejects a name that was typed rather than picked', async () => {
			const interaction = interactionWith({ unhide: 'Ogrelord' });

			await command.execute(interaction);

			expect(unhideTrader).not.toHaveBeenCalled();
		});
	});

	it('refuses hide and unhide together, without changing anything', async () => {
		const interaction = interactionWith({
			hide: TRADER_ID,
			unhide: '223456789012345678',
		});

		await command.execute(interaction);

		expect(hideTrader).not.toHaveBeenCalled();
		expect(unhideTrader).not.toHaveBeenCalled();
		expect(interaction.editReply).toHaveBeenCalledWith(
			messageCopy.hideOrUnhideNotBoth,
		);
	});

	it('routes failures to gracefullyHandleError', async () => {
		const error = new Error('db down');
		vi.mocked(getMarketplaceViewsForUser).mockRejectedValue(error);
		const interaction = interactionWith();

		await command.execute(interaction);

		expect(gracefullyHandleError).toHaveBeenCalledWith(
			error,
			interaction,
			command,
		);
	});
});
