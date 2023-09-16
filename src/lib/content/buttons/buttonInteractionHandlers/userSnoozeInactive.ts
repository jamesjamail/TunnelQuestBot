import { ButtonInteraction } from 'discord.js';
import {
	findOrCreateUser,
	snoozeAllWatches,
} from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleUserSnoozeInactive(
	interaction: ButtonInteraction,
) {
	const data = await snoozeAllWatches(interaction.user.id);
	const user = await findOrCreateUser(interaction.user);
	const components = buttonRowBuilder(CommandTypes.list, [true, false]);
	const embeds = listCommandResponseBuilder(data, user);
	await interaction.update({
		content: messageCopy.allYourWatchesHaveBeenSnoozed(),
		embeds,
		components,
	});
}
