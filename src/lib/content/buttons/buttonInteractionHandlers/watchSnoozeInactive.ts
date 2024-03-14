import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';
import { snoozeWatch } from '../../../../prisma/dbExecutors/watch';

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
	debug_console(messageCopy.yourWatchHasBeenSnoozed());
}
