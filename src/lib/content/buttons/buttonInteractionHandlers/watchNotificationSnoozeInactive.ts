import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { Watch } from '../../../../prisma/client';
import { WatchNotificationMetadata } from '../../../watchNotification/watchNotification';
import { watchNotificationBuilder } from '../../messages/messageBuilder';
import { snoozeWatch } from '../../../../prisma/dbExecutors/watch';

export default async function handleWatchNotificationSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const typedMeta = metadata as WatchNotificationMetadata;
	const data = await snoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(
		MessageTypes.watchNotification,
		[true, false, false, false],
		`${data.id}:${typedMeta.player}`,
	);

	const { player, price, auctionMessage } = typedMeta;

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];

	await interaction.update({
		content: messageCopy.yourWatchHasBeenSnoozed(),
		embeds,
		components,
	});
	debug_console(messageCopy.yourWatchHasBeenSnoozed());
}
