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
vi.mock('../../../../prisma/dbExecutors/playerLink', () => ({
	insertPlayerLinkFull: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../../../../prisma/client';
import handleUnlinkCharacterActive from './unlinkCharacterActive';
import { insertPlayerLinkFull } from '../../../../prisma/dbExecutors/playerLink';
import {
	makeButtonInteraction,
	makePlayerLink,
} from '../../../../test/factories';
import { messageCopy } from '../../copy/messageCopy';

function buttonLabel(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components[0].data.label;
}

describe('handleUnlinkCharacterActive', () => {
	beforeEach(() => {
		vi.mocked(insertPlayerLinkFull).mockImplementation(
			async (link) => link,
		);
	});

	it('calls insertPlayerLinkFull and restores the Unlink button (re-link behavior per TODO)', async () => {
		const metadata = makePlayerLink({
			id: 1,
			player: 'Soandso',
			server: Server.BLUE,
		});
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterActive:1',
		});

		await handleUnlinkCharacterActive(interaction, metadata);

		expect(insertPlayerLinkFull).toHaveBeenCalledWith(metadata);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(interaction.update).toHaveBeenCalledOnce();
		expect(buttonLabel(interaction)).toBe('Unlink');
		expect(vi.mocked(interaction.update).mock.calls[0][0].content).toBe(
			messageCopy.soAndSoHasBeenLinked(metadata),
		);
	});
});
