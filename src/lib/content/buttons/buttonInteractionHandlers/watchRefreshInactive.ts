import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { extendWatch } from '@src/prisma/dbExecutors';
import { messageCopy } from '@src/lib/content/copy/messageCopy';
import { watchCommandResponseBuilder } from '@src/lib/content/messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '@helpers/helpers';

export default async function handleWatchRefreshInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await extendWatch(metadata as Watch);
	const components = buttonRowBuilder(MessageTypes.watch, [
		isSnoozed(data.snoozedUntil),
		false,
		true,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenExtended,
		embeds,
		components,
	});
}
