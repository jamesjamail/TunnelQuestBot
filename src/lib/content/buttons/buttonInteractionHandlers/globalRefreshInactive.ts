import { ButtonInteraction } from 'discord.js';
import { extendAllWatchesAndReturnUserAndWatches } from '@src/prisma/dbExecutors';
import { messageCopy } from '@src/lib/content/copy/messageCopy';
import { listCommandResponseBuilder } from '@src/lib/content/messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

export default async function handleGlobalRefreshInactive(
	interaction: ButtonInteraction,
) {
	const { watches, user } = await extendAllWatchesAndReturnUserAndWatches(
		interaction.user.id,
	);
	const components = buttonRowBuilder(MessageTypes.list, [false, true]);
	const embeds = listCommandResponseBuilder(watches, user);
	await interaction.update({
		content: messageCopy.globalSnoozeHasBeenRemoved,
		embeds,
		components,
	});
}
