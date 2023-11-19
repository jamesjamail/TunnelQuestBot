import { ButtonInteraction } from 'discord.js';
import { snoozeAllWatchesAndReturnWatchesAndUser } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { listCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

export default async function handleUserSnoozeInactive(
	interaction: ButtonInteraction,
) {
	const { watches, user } = await snoozeAllWatchesAndReturnWatchesAndUser(
		interaction.user.id,
	);
	const components = buttonRowBuilder(MessageTypes.list, [true, false]);
	const embeds = listCommandResponseBuilder(watches, user);
	await interaction.update({
		content: messageCopy.allYourWatchesHaveBeenSnoozed(),
		embeds,
		components,
	});
}
