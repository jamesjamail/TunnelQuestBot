import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { upsertWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/helpers';

export default async function handleUnwatchActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await upsertWatch(interaction.user.id, metadata as Watch);
	const components = buttonRowBuilder(CommandTypes.watch, [
		isSnoozed(data.snoozedUntil),
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
