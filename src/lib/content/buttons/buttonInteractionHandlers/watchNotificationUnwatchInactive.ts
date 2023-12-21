import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { MessageTypes } from '../buttonRowBuilder';
import { confirmButtonInteraction } from '../buttonHelpers';
import { unwatch } from '../../../../prisma/dbExecutors/watch';

export default async function handleWatchNotificationUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			const typedWatch = metadata as Watch;
			await unwatch(typedWatch);
			await followUpMessage.delete();
			await interaction.editReply({
				content: messageCopy.yourWatchHasBeenUnwatched(
					typedWatch.itemName,
					typedWatch.server,
				),
				embeds: [],
				components: [],
			});
		},
		'Are you sure you want to unwatch?',
		MessageTypes.watchNotification,
	);
}
