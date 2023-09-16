import { ButtonInteraction } from 'discord.js';
import { extendAllWatches } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleGlobalRefreshInactive(
	interaction: ButtonInteraction,
) {
	const data = await extendAllWatches(interaction.user.id);
	const components = buttonRowBuilder(CommandTypes.list, [false, true]);
	const embeds = listCommandResponseBuilder(data);
	await interaction.update({
		content: messageCopy.globalSnoozeHasBeenRemoved,
		embeds,
		components,
	});
}
