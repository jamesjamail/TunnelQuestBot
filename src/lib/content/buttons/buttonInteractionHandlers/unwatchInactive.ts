import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { unwatch } from '../../../../prisma/dbExecutors/watch';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/watches';

export default async function handleUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const typedWatch = metadata as Watch;
	const data = await unwatch(typedWatch);
	const embeds = [watchCommandResponseBuilder(data)];
	const components = buttonRowBuilder(MessageTypes.watch, [
		isSnoozed(data.snoozedUntil),
		true,
		false,
	]);
	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnwatched(
			typedWatch.itemName,
			typedWatch.server,
		),
		embeds,
		components,
	});
}
