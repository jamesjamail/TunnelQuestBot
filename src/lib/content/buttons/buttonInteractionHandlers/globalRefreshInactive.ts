import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { extendAllWatchesAndReturnUserAndWatches } from '../../../../prisma/dbExecutors/watch';

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
