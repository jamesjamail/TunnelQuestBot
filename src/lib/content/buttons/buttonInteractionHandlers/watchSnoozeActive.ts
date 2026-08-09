import type { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import type { Watch } from '../../../../prisma/client';
import { unsnoozeWatch } from '../../../../prisma/dbExecutors/watch';
import { debug } from '../../../helpers/logger';

export default async function handleWatchSnoozeActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await unsnoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(
		MessageTypes.watch,
		[false, false, false],
		String(data.id),
	);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnsnoozed,
		embeds,
		components,
	});
	debug(messageCopy.yourWatchHasBeenUnsnoozed);
}
