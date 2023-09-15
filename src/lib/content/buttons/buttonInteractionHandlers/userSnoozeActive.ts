import { User } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import {
	extendAllWatches,
	findOrCreateUser,
} from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleUserSnoozeActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await extendAllWatches(metadata as User);
	const user = await findOrCreateUser(interaction.user);
	const components = buttonRowBuilder(CommandTypes.list, [false, false]);
	const embeds = listCommandResponseBuilder(data, user);
	await interaction.update({
		content: messageCopy.yourWatchHasBeenExtended,
		embeds,
		components,
	});
}
