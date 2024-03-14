import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { addPlayerBlockByWatch } from '../../../../prisma/dbExecutors/block';
import {
	getWatchByWatchId,
	WatchWithUserAndBlockedWatches,
} from '../../../../prisma/dbExecutors/watch';
import { isSnoozed } from '../../../helpers/watches';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

type WatchBlockInactiveMetadata = WatchWithUserAndBlockedWatches & {
	player: string;
};

export default async function handleWatchBlockInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id, player, user } = metadata as WatchBlockInactiveMetadata;
	const data = await addPlayerBlockByWatch(user.discordUserId, id, player);
	const watch = await getWatchByWatchId(id);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		isSnoozed(watch.snoozedUntil),
		false,
		true,
		false,
	]);
	await interaction.update({
		content: messageCopy.soAndSoHasBeenBlockedForThisWatch(data),
		components,
	});
	debug_console(messageCopy.soAndSoHasBeenBlockedForThisWatch(data));
}
