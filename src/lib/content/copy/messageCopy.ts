import type {
	BlockedPlayer,
	BlockedPlayerByWatch,
	PlayerLink,
	Server,
} from '../../../prisma/client';
import { config } from '../../../config';
import { formatServerFromEnum } from '../../helpers/watches';
import { toTitleCase } from '../../helpers/titleCase';

//	Read through getters rather than at module load: config() validates the whole
//	environment on first call, and importing a copy string should not require a
//	complete .env. The three members below are the only env-dependent ones.
const commandChannel = () => config().COMMAND_CHANNEL;
const feedbackAndIdeasChannel = () => config().FEEDBACK_AND_IDEAS_CHANNEL;
const watchDuration = () => config().WATCH_DURATION_IN_DAYS;

export const messageCopy = {
	get helpMsg() {
		return (
			'\n\n' +
			'__***HELP***__\n' +
			' • TunnelQuestBot uses Discord Slash Commands.  Type `/` in' +
			`<#${commandChannel()}>` +
			' to get started.\n' +
			'\n' +
			'__***COMMANDS***__\n' +
			'**/help**\n' +
			'> Displays available commands.\n\n' +
			'**/watch `type` `item` `server` `price criteria` `notes`**\n' +
			'> Receive a notification when an in-game item is auctioned meeting your criteria\n\n' +
			'**/get watch `watch`**\n' +
			'> Get information about an existing watch\n\n' +
			'**/unwatch `watch` **\n' +
			'> Ends a currently running watch.\n\n' +
			'**/watches `search filter`**\n' +
			'> Returns watches as an individual messages. An optional search filter can be specified.  For example: `/watches belt of` returns all watches containing "belt of".\n\n' +
			'**/list**\n' +
			'> Lists details for all watches in a concise message.\n\n' +
			'**/block `seller` `server`**\n' +
			'>  Blocks a seller from triggering any watch notifications.\n\n' +
			'**/blocks `search filter`**\n' +
			'> Returns every block as an individual message. An optional search filter can be specified for the player name.\n\n' +
			'**/unblock `blocked player`**\n' +
			'> Unblocks a player for all watch notifications.\n\n' +
			'**/snooze `watch` `hours`**\n' +
			'> Pauses notifications on a specific watch.  `hours` is optional; if omitted, watch is snoozed for 6 hours.  Use `All Watches` option to Snooze all watches.\n\n' +
			'**/unsnooze `watch`**\n' +
			'> Unsnooze a specific watch, or all watches with the `All Watches` option.\n\n' +
			'**/link **\n' +
			'> Link a character to your discord user.\n\n' +
			'**/links `search filter`**\n' +
			'> Show current characters linked to your discord user.\n\n' +
			'**/unlink `player` `server`**\n' +
			'> Unlink a character from your discord user.\n\n' +
			'__***TIPS***__\n' +
			' • You can use `/watch` to update an existing watch if you wish to modify the price requirement.\n' +
			' • Most responses have buttons that trigger useful commands.\n' +
			' • To report a problem or request a feature, talk to us in ' +
			`<#${feedbackAndIdeasChannel()}>`
		);
	},

	get welcomeMsg() {
		return (
			'Hello! I am TunnelQuestBot, your helpful gnome assistant. Please allow me to make buying and selling items easier so you can finally start tipping for ports.\n\n' +
			"I watch EC auctions on both Blue and Green servers. If you're in the market for a new sword, you can set up a watch with the `/watch` command.\n\n" +
			'Commands can be entered in' +
			`<#${commandChannel()}>:\n\n` +
			'or as a Direct Message to me.\n\n' +
			"Let's say you're in the market for a weapon upgrade.\n\n" +
			'`/watch` `rusty bastard sword` `green server`\n\n' +
			'If you only have 5pp to spend, you can enter a price criteria:\n\n' +
			'`/watch` `rusty bastard sword` `green server` `5`\n\n' +
			"Whenever I find a match, I'll send you a direct message with all the pertinent info.\n\n" +
			`Watches last ${watchDuration()} days before they expire, and can be renewed at any time.\n\n` +
			'Most responses feature buttons which trigger useful commands.\n\n\n' +
			'You can also check out our Tunnel Stream channels.\n\n' +
			'Auction message are displayed at the top of each post with links to the wiki items beneath.  Hovering over the item name displays historical pricing data courtesy of the P1999 wiki.\n\n\n' +
			'For more information, try the `/help` command.\n\n\n' +
			'**Welcome to the server!**'
		);
	},

	yourWatchHasBeenSnoozed: (hours = 6) =>
		`Your watch has been snoozed for ${hours} hours.`,

	yourWatchHasBeenUnsnoozed: 'Your watch has been unsnoozed.',

	yourWatchHasBeenUnwatched: (name: string, server: Server) => {
		return `Your watch for \`${name}\` on \`${server}\` has been removed.`;
	},

	allYourWatchesHaveBeenUnwatched: 'All your watches have been unwatched.',

	yourWatchHasBeenRestored: (name: string, server: Server) => {
		return `Your watch for \`${name}\` on \`${server}\` has been restored.`;
	},

	get yourWatchHasBeenExtended() {
		return `Your watch has been extended for another ${watchDuration()} days.`;
	},

	allYourWatchesHaveBeenSnoozed: (hours = 6) => {
		return `All your watches have been snoozed for ${hours} hours.  Use the 💤 button below to unsnooze.`;
	},

	globalSnoozeHasBeenRemoved:
		'Global snooze has been been removed.  Your watches may still have individual snoozes applied.',

	iCouldntFindAnyWatchesForItemName: (itemName: string) => {
		return `I couldn't find any watches for item \`${itemName}\`.  Try creating one with /watch.`;
	},

	watchesHaveBeenDeliveredViaDm: (
		numberOfWatches: number,
		channelId: string,
	) => {
		if (numberOfWatches > 0) {
			return `${numberOfWatches} watch${
				numberOfWatches > 1 ? 'es' : ''
			} ${
				numberOfWatches > 1 ? 'have' : 'has'
			} been delivered via DM <#${channelId}>`;
		} else {
			return 'No watches found.';
		}
	},

	linksHaveBeenDeliveredViaDm: (numberOfLinks: number, channelId: string) => {
		if (numberOfLinks > 0) {
			return `${numberOfLinks} character link${
				numberOfLinks > 1 ? 's' : ''
			} ${
				numberOfLinks > 1 ? 'have' : 'has'
			} been delivered via DM <#${channelId}>`;
		} else {
			return 'No character links found.';
		}
	},

	blocksHaveBeenDeliveredViaDm: (
		numberOfBlocks: number,
		channelId: string,
	) => {
		if (numberOfBlocks > 0) {
			return `${numberOfBlocks} block${numberOfBlocks > 1 ? 's' : ''} ${
				numberOfBlocks > 1 ? 'have' : 'has'
			} been delivered via DM <#${channelId}>`;
		} else {
			return 'No blocks found.';
		}
	},

	soAndSoHasBeenBlocked: (block: BlockedPlayer) => {
		return `\`${
			block.player
		}\` has been blocked on \`${formatServerFromEnum(block.server)}\``;
	},

	soAndSoHasBeenUnblocked: (block: BlockedPlayer) => {
		return `\`${
			block.player
		}\` has been unblocked on \`${formatServerFromEnum(block.server)}\``;
	},

	soAndSoHasBeenBlockedForThisWatch: (block: BlockedPlayerByWatch) => {
		return `You will no longer receive Watch Notifications for auctions from \`${block.player}\` for this watch.`;
	},

	soAndSoHasBeenUnblockedForThisWatch: (block: BlockedPlayerByWatch) => {
		return `You will once again receive Watch Notifications for auctions from \`${block.player}\` for this watch.`;
	},

	soAndSoHasBeenLinked: (link: PlayerLink) => {
		return `\`${link.player}\` on \`${link.server}\` has been linked to your discord user.`;
	},

	soAndSoHasBeenUnlinked: (link: PlayerLink) => {
		return `\`${link.player}\` on \`${link.server}\` has been unlinked from your discord user.`;
	},

	soAndSoHasFailedToBeUnlinked: (link: PlayerLink) => {
		return `No such character link (\`${link.player}\` on \`${link.server}\`) exists for your discord user.`;
	},

	youDontHaveAnyBlocks: (filter: string) => {
		if (filter) {
			return `You don't have any blocks that contain **${filter}**.`;
		}

		return `You don't have any blocks.  Add some with \`\`/block\`\``;
	},

	heresInformationOnYourWatch: (watch: string) =>
		`Here's information on your \`\`${toTitleCase(watch)}\`\` watch:`,

	heresAListOfYourWatches: `Here's a list of your watches organized by server.`,

	youDontHaveAnyWatches: `You don't have any watches.  Add some with \`/watch\``,
};
