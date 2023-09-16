import { ButtonInteraction } from 'discord.js';
import { snoozeWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';

export default async function handleWatchSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await snoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(CommandTypes.watch, [
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
