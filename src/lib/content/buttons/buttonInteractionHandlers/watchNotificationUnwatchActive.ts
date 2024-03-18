import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { setWatchActiveByWatchId } from '../../../../prisma/dbExecutors/watch';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/watches';
import { WatchNotificationMetadata } from '../../../watchNotification/watchNotification';
import { watchNotificationBuilder } from '../../messages/messageBuilder';

export default async function handleWatchNotificationUnwatchActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const typedWatch = metadata as WatchNotificationMetadata;
	const data = await setWatchActiveByWatchId(typedWatch.id);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		isSnoozed(data.snoozedUntil),
		false,
		false,
	]);

	const { player, price, auctionMessage } = typedWatch;

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenRestored(
			typedWatch.itemName,
			typedWatch.server,
		),
		components,
		embeds,
	});
	debug_console(
		messageCopy.yourWatchHasBeenRestored(
			typedWatch.itemName,
			typedWatch.server,
		),
	);
}
