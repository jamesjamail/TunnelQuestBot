import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/watches';
import { WatchNotificationMetadata } from '../../../watchNotification/watchNotification';
import { watchNotificationBuilder } from '../../messages/messageBuilder';
import { extendWatch } from '../../../../prisma/dbExecutors/watch';

export default async function handleWatchNotificationRefreshInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const data = await extendWatch(metadata as Watch);
	const components = buttonRowBuilder(MessageTypes.watchNotification, [
		isSnoozed(data.snoozedUntil),
		false,
		false,
		true,
	]);

	const { player, price, auctionMessage } =
		metadata as WatchNotificationMetadata;

	const embeds = [
		await watchNotificationBuilder(data, player, price, auctionMessage),
	];
	await interaction.update({
		content: messageCopy.yourWatchHasBeenExtended,
		embeds,
		components,
	});
	debug_console(messageCopy.yourWatchHasBeenExtended);
}
