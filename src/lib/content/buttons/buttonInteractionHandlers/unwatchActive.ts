import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { setWatchActiveByWatchId } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/helpers';

export default async function handleUnwatchActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id } = metadata as Watch;
	const data = await setWatchActiveByWatchId(id);
	const components = buttonRowBuilder(MessageTypes.watch, [
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
