import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { unwatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/helpers';

export default async function handleUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await unwatch(metadata as Watch);
	const components = buttonRowBuilder(CommandTypes.watch, [
		isSnoozed(data.snoozedUntil),
		true,
		false,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnwatched,
		embeds,
		components,
	});
}
