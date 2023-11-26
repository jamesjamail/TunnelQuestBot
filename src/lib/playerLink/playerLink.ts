import { Server } from '@prisma/client';
import { client } from '../..';
import { messageCopy } from '../content/copy/messageCopy';
import { authPlayerLink } from '../../prisma/dbExecutors/playerLink';

export type InGameItemNamesType = { [key: string]: string };

export async function handleLinkMatch(
	player: string,
	server: Server,
	linkCode: string,
) {
	const link = await authPlayerLink(player, server, linkCode);
	if (link) {
		const user = await client.users
			.fetch(link.discordUserId)
			.catch(() => null);
		if (user) {
			await user
				.send(messageCopy.soAndSoHasBeenLinked(link))
				.catch(() => {
					// TODO: swallow, throw, or log this error?
					// await gracefullyHandleError(e);
					// console.log("User has DMs closed or has no mutual servers with the bot.");
				});
			// console.log("Player link successful.")
		}
	} else {
		// console.log("Link attempt failed.")
	}
}
