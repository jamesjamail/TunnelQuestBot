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
	removePlayerLinkById: vi.fn(),
}));

import { describe, it, expect } from 'vitest';
import { Server } from '../../../../prisma/client';
import handleUnlinkCharacterInactive from './unlinkCharacterInactive';
import { removePlayerLinkById } from '../../../../prisma/dbExecutors/playerLink';
import {
	makeButtonInteraction,
	makePlayerLink,
} from '../../../../test/factories';

function buttonLabel(interaction: ReturnType<typeof makeButtonInteraction>) {
	const payload = vi.mocked(interaction.update).mock.calls[0][0];
	return payload.components[0].components[0].data.label;
}

describe('handleUnlinkCharacterInactive', () => {
	const metadata = makePlayerLink({
		id: 1,
		player: 'Soandso',
		server: Server.BLUE,
	});

	it('on success marks the embed title and switches to Relink', async () => {
		vi.mocked(removePlayerLinkById).mockResolvedValue(true);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
		});

		await handleUnlinkCharacterInactive(interaction, metadata);

		expect(removePlayerLinkById).toHaveBeenCalledWith(1);
		expect(interaction.reply).not.toHaveBeenCalled();
		expect(
			vi.mocked(interaction.update).mock.calls[0][0].embeds[0].data.title,
		).toBe('⛓️‍💥 Soandso (BLUE)');
		expect(buttonLabel(interaction)).toBe('Relink');
	});

	it('on failure keeps Unlink and leaves the title unchanged', async () => {
		vi.mocked(removePlayerLinkById).mockResolvedValue(false);
		const interaction = makeButtonInteraction({
			customId: 'UnlinkCharacterInactive:1',
		});

		await handleUnlinkCharacterInactive(interaction, metadata);

		expect(
			vi.mocked(interaction.update).mock.calls[0][0].embeds[0].data.title,
		).toBe('Soandso (BLUE)');
		expect(buttonLabel(interaction)).toBe('Unlink');
	});
});
