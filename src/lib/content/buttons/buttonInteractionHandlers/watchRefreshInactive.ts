import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { extendWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { MessageTypes, buttonRowBuilder } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/helpers';

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
