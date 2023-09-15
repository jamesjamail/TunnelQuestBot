import { Watch, SnoozedWatch, Server } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import {
	formatSnoozeExpirationTimestamp,
	formatWatchExpirationTimestamp,
} from '../../helpers/datetime';
import { getServerColorFromString } from '../../helpers/colors';

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

function formatCapitalCase(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}
export function listCommandResponseBuilder(
	watches: WatchWithSnoozedWatches[],
	// user: User & { snoozedUsers: SnoozedUser[] },
): EmbedBuilder[] {
	// Group the watches by server
	const watchesByServer: { [key: string]: WatchWithSnoozedWatches[] } = {};

	watches.forEach((watch) => {
		if (!watchesByServer[watch.server]) {
			watchesByServer[watch.server] = [];
		}
		watchesByServer[watch.server].push(watch);
	});

	const serverEntries = Object.entries(watchesByServer);
	const totalServers = serverEntries.length;

	// Convert each grouped watches to an embed
	const embeds: EmbedBuilder[] = serverEntries.map(
		([server, serverWatches], index) => {
			const fields = serverWatches
				.map((watch) => {
					const price = watch.priceRequirement
						? `$${watch.priceRequirement}`
						: 'no price criteria';

					const watchFields = [];

					watchFields.push({
						name: `\`${formatCapitalCase(
							watch.itemName,
						)}\` | \`${price}\``,
						value: `${formatWatchExpirationTimestamp(
							watch.created,
						)}`,
						inline: false,
					});

					if (
						watch.snoozedWatches &&
						watch.snoozedWatches.length > 0
					) {
						watchFields.push({
							name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
							value: `${formatSnoozeExpirationTimestamp(
								watch.snoozedWatches[0].endTimestamp,
							)}`,
							inline: false,
						});
					}

					return watchFields;
				})
				.flat();

			// const globalSnoozeActive = user.snoozedUsers.length > 0;
			// TODO: if global snooze active, add a brief message above the list response
			// informing global snooze active, watch snoozes are listed below
			const embed = new EmbedBuilder()
				.setAuthor({
					name: `Project 1999 ${formatCapitalCase(server)} Server`,
				})
				.setColor(getServerColorFromString(server as Server))
				.addFields(fields);

			// If it's the last embed, set the footer
			if (index === totalServers - 1) {
				embed.setFooter({
					text: 'To snooze all watches for 6 hours, click 💤\nTo extend all watches, click ♻️',
				});
			}

			return embed;
		},
	);

	return embeds;
}
