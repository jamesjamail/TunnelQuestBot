import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { unwatch } from '../../../../prisma/dbExecutors/watch';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { watchNotificationBuilder } from '../../messages/messageBuilder';
import { WatchNotificationMetadata } from '../../../watchNotification/watchNotification';

export default async function handleWatchNotificationUnwatchInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const typedWatch = metadata as WatchNotificationMetadata;
	const data = await unwatch(typedWatch);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		false,
		true,
		false,
	]);

	const { player, price, auctionMessage } = typedWatch;

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];

	await interaction.update({
		content: messageCopy.yourWatchHasBeenUnwatched(
			typedWatch.itemName,
			typedWatch.server,
		),
		components,
		embeds,
	});
	debug_console(
		messageCopy.yourWatchHasBeenUnwatched(
			typedWatch.itemName,
			typedWatch.server,
		),
	);
}
