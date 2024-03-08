import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { removeWatchBlockByPlayerName } from '../../../../prisma/dbExecutors/block';
import {
	WatchWithUserAndBlockedWatches,
	getWatchByWatchId,
} from '../../../../prisma/dbExecutors/watch';
import { isSnoozed } from '../../../helpers/watches';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

type WatchBlockInactiveMetadata = WatchWithUserAndBlockedWatches & {
	player: string;
};

export default async function handleWatchBlockActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id, player } = metadata as WatchBlockInactiveMetadata;
	const data = await removeWatchBlockByPlayerName(id, player);
	const watch = await getWatchByWatchId(id);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		isSnoozed(watch.snoozedUntil),
		false,
		false,
		false,
	]);
	await interaction.update({
		content: messageCopy.soAndSoHasBeenUnblockedForThisWatch(data),
		components,
	});
}
