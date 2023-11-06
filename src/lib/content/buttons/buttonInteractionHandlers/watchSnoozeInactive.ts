import { ButtonInteraction } from 'discord.js';
import { snoozeWatch } from '@src/prisma/dbExecutors';
import { messageCopy } from '@src/lib/content/copy/messageCopy';
import { watchCommandResponseBuilder } from '@src/lib/content/messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';

export default async function handleWatchSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await snoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(MessageTypes.watch, [
		true,
		false,
		false,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenSnoozed(),
		embeds,
		components,
	});
}
