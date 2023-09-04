import { Watch, SnoozedWatch } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import {
	formatSnoozeExpirationTimestamp,
	formatWatchExpirationTimestamp,
} from '../../helpers/datetime';
import { getServerColorFromString } from '../colors';

type WatchWithSnoozedWatches = Watch & {
	snoozedWatches: SnoozedWatch[];
};

export function watchCommandResponseBuilder(
	watchData: WatchWithSnoozedWatches,
) {
	const price = watchData.priceRequirement ?? 'No Price Criteria';
	const formattedExpirationTimestamp = formatWatchExpirationTimestamp(
		watchData.created,
	);
	const fields = [
		{
			name: `${watchData.watchType}   |   ${price}`,
			// TODO: make this conditional based on watchType
			value: 'This watch will only trigger for WTS auctions',
			inline: false,
		},
		{
			name: `Project 1999 ${watchData.server} Server`,
			value: `${formattedExpirationTimestamp}`,
			inline: false,
		},
	];

	if (watchData.snoozedWatches.length > 0) {
		const formattedSnoozeExpirationTimestamp =
			formatSnoozeExpirationTimestamp(
				watchData.snoozedWatches[0].endTimestamp,
			);
		fields.push({
			name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
			value: `${formattedSnoozeExpirationTimestamp}`,
			inline: false,
		});
	}

	return new EmbedBuilder()
		.setColor(getServerColorFromString(watchData.server))
		.setAuthor({ name: 'Auction Watch' })
		.setTitle(`--- ${watchData.itemName} ---`)
		.addFields(fields)
		.setFooter({
			text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻️',
		});
}
