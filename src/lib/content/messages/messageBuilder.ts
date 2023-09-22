import { Watch, Server, User, BlockedPlayer } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import {
	formatSnoozeExpirationTimestamp,
	formatWatchExpirationTimestamp,
} from '../../helpers/datetime';
import { getServerColorFromString } from '../../helpers/colors';

export function watchCommandResponseBuilder(watchData: Watch) {
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

	if (watchData.snoozedUntil) {
		const formattedSnoozeExpirationTimestamp =
			formatSnoozeExpirationTimestamp(watchData.snoozedUntil);
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
	watches: Watch[],
	// TODO: add an embed above servers if global snooze is active
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_user?: User,
): EmbedBuilder[] {
	// Group the watches by server
	const watchesByServer: { [key: string]: Watch[] } = {};

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
					// TODO: check if snooze has not yet past
					if (watch.snoozedUntil) {
						watchFields.push({
							name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
							value: `${formatSnoozeExpirationTimestamp(
								watch.snoozedUntil,
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

export function blockCommandResponseBuilder(block: BlockedPlayer) {
	// const fields = [
	// 	{
	// 		name: `${block.watchType}   |   ${price}`,
	// 		// TODO: make this conditional based on watchType
	// 		value: 'This watch will only trigger for WTS auctions',
	// 		inline: false,
	// 	},
	// 	{
	// 		name: `Project 1999 ${block.server} Server`,
	// 		value: `${formattedExpirationTimestamp}`,
	// 		inline: false,
	// 	},
	// ];

	return new EmbedBuilder()
		.setColor(getServerColorFromString(block.server))
		.setAuthor({ name: 'Player Block' })
		.setTitle(`--- ${block.player} ---`)
		.setFooter({
			text: 'To remove this block, click ❌',
		});
}
