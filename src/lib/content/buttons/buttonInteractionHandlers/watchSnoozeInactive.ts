import type { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import type { Watch } from '../../../../prisma/client';
import { snoozeWatch } from '../../../../prisma/dbExecutors/watch';
import { debug } from '../../../helpers/logger';

export default async function handleWatchSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await snoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(
		MessageTypes.watch,
		[true, false, false],
		String(data.id),
	);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenSnoozed(),
		embeds,
		components,
	});
	debug(messageCopy.yourWatchHasBeenSnoozed());
}
