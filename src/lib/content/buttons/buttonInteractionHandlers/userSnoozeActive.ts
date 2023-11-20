import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { findOrCreateUser } from '../../../../prisma/dbExecutors/user';
import { extendAllWatchesAndReturnWatches } from '../../../../prisma/dbExecutors/watch';

export default async function handleUserSnoozeActive(
	interaction: ButtonInteraction,
) {
	const data = await extendAllWatchesAndReturnWatches(interaction.user.id);
	const user = await findOrCreateUser(interaction.user);
	const components = buttonRowBuilder(MessageTypes.list, [false, false]);
	const embeds = listCommandResponseBuilder(data, user);
	await interaction.update({
		content: messageCopy.globalSnoozeHasBeenRemoved,
		embeds,
		components,
	});
}
