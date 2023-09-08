import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { upsertWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleUnwatchActive(
	interaction: ButtonInteraction,
	metadata: Watch,
) {
	const data = await upsertWatch(interaction.user.id, metadata);
	const isSnoozed = !!data.snoozedWatches.length;
	const components = buttonRowBuilder(CommandTypes.watch, [
		isSnoozed,
		false,
		false,
	]);
	const embeds = [watchCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.yourWatchIsActiveAgain,
		embeds,
		components,
	});
}
