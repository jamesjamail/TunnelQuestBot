import { ButtonInteraction } from 'discord.js';
import { unsnoozeWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';

export default async function handleWatchSnoozeActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await unsnoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(CommandTypes.watch, [
		false,
		false,
		false,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnsoozed,
		embeds,
		components,
	});
}
