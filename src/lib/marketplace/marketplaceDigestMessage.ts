import type {
	MarketplaceCounterpart,
	WatchWithUser,
} from '../../prisma/dbExecutors/marketplace';
import { marketplaceDigestBuilder } from '../content/messages/messageBuilder';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../content/buttons/buttonRowBuilder';
import { isSnoozed } from '../helpers/watches';

// 	The button state is read off the watch itself, so the message is a pure
// 	function of current data: the DM, and every re-render after a click, come
// 	out of here and cannot drift apart.
export function buildMarketplaceDigestMessage(
	watch: WatchWithUser,
	counterparts: MarketplaceCounterpart[],
	heading: string,
) {
	return {
		embeds: [marketplaceDigestBuilder(watch, counterparts, heading)],
		components: buttonRowBuilder(
			MessageTypes.marketplace,
			[
				isSnoozed(watch.snoozedUntil),
				!watch.active,
				false,
				watch.isPublicallyTradeable,
			],
			String(watch.id),
		),
	};
}
