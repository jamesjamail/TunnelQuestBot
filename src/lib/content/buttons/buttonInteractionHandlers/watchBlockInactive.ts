import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { MessageTypes } from '../buttonRowBuilder';
import {
	confirmButtonInteraction,
	removeInteractionContentAfterDelay,
} from '../buttonHelpers';
import { addPlayerBlockByWatch } from '../../../../prisma/dbExecutors/block';
import { WatchWithUserAndBlockedWatches } from '../../../../prisma/dbExecutors/watch';

type WatchBlockInactiveMetadata = WatchWithUserAndBlockedWatches & {
	player: string;
};

export default async function handleWatchBlockInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			const { id, player, user } = metadata as WatchBlockInactiveMetadata;
			const data = await addPlayerBlockByWatch(
				user.discordUserId,
				id,
				player,
			);
			await followUpMessage.delete();
			await interaction.editReply({
				content: messageCopy.soAndSoHasBeenBlockedForThisWatch(data),
				embeds: [],
				components: [],
			});
			await removeInteractionContentAfterDelay(interaction, 5000);
		},
		'Are you sure wish to block this seller for this item?',
		MessageTypes.watchNotification,
	);
}
