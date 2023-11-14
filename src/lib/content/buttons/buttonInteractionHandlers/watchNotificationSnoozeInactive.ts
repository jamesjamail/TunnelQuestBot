import { ButtonInteraction } from 'discord.js';
import { snoozeWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { Watch } from '@prisma/client';
import { WatchNotificationMetadata } from '../../../helpers/watchNotification';
import { watchNotificationBuilder } from '../../messages/messageBuilder';

export default async function handleWatchNotificationSnoozeInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await snoozeWatch(metadata as Watch);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		true,
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
		content: messageCopy.yourWatchHasBeenSnoozed(),
		embeds,
		components,
	});
}
