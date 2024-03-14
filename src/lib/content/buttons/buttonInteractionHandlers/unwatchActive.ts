import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { setWatchActiveByWatchId } from '../../../../prisma/dbExecutors/watch';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/watches';

export default async function handleUnwatchActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const typedWatch = metadata as Watch;
	const data = await setWatchActiveByWatchId(typedWatch.id);
	const embeds = [watchCommandResponseBuilder(data)];
	const components = buttonRowBuilder(MessageTypes.watch, [
		isSnoozed(data.snoozedUntil),
		false,
		false,
	]);

	await interaction.update({
		content: messageCopy.yourWatchHasBeenRestored(
			typedWatch.itemName,
			typedWatch.server,
		),
		components,
		embeds,
	});
	debug_console(
		messageCopy.yourWatchHasBeenRestored(
			typedWatch.itemName,
			typedWatch.server,
		),
	);
}
