import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { extendWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { watchCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleWatchRefreshInactive(
	interaction: ButtonInteraction,
	metadata: Watch,
) {
	const data = await extendWatch(metadata);
	const isSnoozed = !!data.snoozedWatches.length;
	const components = buttonRowBuilder(CommandTypes.watch, [
		isSnoozed,
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
