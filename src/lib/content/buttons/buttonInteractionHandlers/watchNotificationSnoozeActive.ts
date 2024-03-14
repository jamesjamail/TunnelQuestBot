import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';
import { watchNotificationBuilder } from '../../messages/messageBuilder';
import { WatchNotificationMetadata } from '../../../watchNotification/watchNotification';
import { unsnoozeWatch } from '../../../../prisma/dbExecutors/watch';

export default async function handleWatchNotificationSnoozeActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await unsnoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		false,
		false,
		false,
		false,
	]);

	const { player, price, auctionMessage } =
		metadata as WatchNotificationMetadata;

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];

	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnsnoozed,
		embeds,
		components,
	});
	debug_console(messageCopy.yourWatchHasBeenUnsnoozed);
}
