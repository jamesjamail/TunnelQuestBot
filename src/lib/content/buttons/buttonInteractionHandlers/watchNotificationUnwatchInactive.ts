import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { unwatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { confirmButtonInteraction } from '../../../helpers/buttons';
import { MessageTypes } from '../buttonRowBuilder';

export default async function handleWatchNotificationUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			await unwatch(metadata as Watch);
			await followUpMessage.delete();
			await interaction.editReply({
				content: messageCopy.yourWatchHasBeenUnwatched,
				embeds: [],
				components: [],
			});
			// TODO: delete reply after 10 seconds.
		},
		'Are you sure you want to unwatch?',
		MessageTypes.watchNotification,
	);
}