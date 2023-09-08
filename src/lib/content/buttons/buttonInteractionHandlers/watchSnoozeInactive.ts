import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { snoozeWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleWatchSnoozeInactive(
	interaction: ButtonInteraction,
	metadata: Watch,
) {
	const data = await snoozeWatch(metadata);
	const components = buttonRowBuilder(CommandTypes.watch, [
		true,
		false,
		false,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenSnoozed,
		embeds,
		components,
	});
}
