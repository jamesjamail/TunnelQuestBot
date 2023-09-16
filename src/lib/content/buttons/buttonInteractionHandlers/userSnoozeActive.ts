import { ButtonInteraction } from 'discord.js';
import {
	extendAllWatches,
	findOrCreateUser,
} from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleUserSnoozeActive(
	interaction: ButtonInteraction,
) {
	const data = await extendAllWatches(interaction.user.id);
	const user = await findOrCreateUser(interaction.user);
	const components = buttonRowBuilder(CommandTypes.list, [false, false]);
	const embeds = listCommandResponseBuilder(data, user);
	await interaction.update({
		content: messageCopy.globalSnoozeHasBeenRemoved,
		embeds,
		components,
	});
}
