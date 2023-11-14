import { Watch } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { extendWatch } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { isSnoozed } from '../../../helpers/helpers';
import { WatchNotificationMetadata } from '../../../helpers/watchNotification';
import { watchNotificationBuilder } from '../../messages/messageBuilder';

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
}
