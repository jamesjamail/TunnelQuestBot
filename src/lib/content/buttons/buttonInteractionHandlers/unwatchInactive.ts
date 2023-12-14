import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { MessageTypes } from '../buttonRowBuilder';
import { confirmButtonInteraction } from '../buttonHelpers';
import { unwatch } from '../../../../prisma/dbExecutors/watch';

export default async function handleUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			await unwatch(metadata as Watch);
			await followUpMessage.delete();

			const editedReply = await interaction
				.editReply({
					content: messageCopy.yourWatchHasBeenUnwatched,
					embeds: [],
					components: [],
				})
				.catch(() => null);

			setTimeout(async () => {
				// TODO: this is probably related to the debouncing issue...
				// this seems like a discord bug...
				// ephemeral messages cannot be deleted.
				// confirmButtonInteraction appears on the unwatch button which
				// is featured on watches.  Some watches are command
				// replies (/watch), while some are messages (/watches).
				// Command replies are ephemeral, and no amount of fetching the message
				// and verifying its deleteable property will prevent discord throwing
				// an error when delete is called. We still want to clean up the
				// message if it's not ephemeral, so we still delete but catch and
				// swallow the error.
				await editedReply?.delete().catch(() => {
					console.log('swallowed delete error');
				});
			}, 5000);
		},
		'Are you sure you want to unwatch?',
		MessageTypes.watch,
	);
}
