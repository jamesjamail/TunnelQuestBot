import { Server } from '@prisma/client';
import { client } from '../..';
import { messageCopy } from '../content/copy/messageCopy';
import { authPlayerLink } from '../../prisma/dbExecutors/playerLink';
import { gracefullyHandleError } from '../helpers/errors';

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
				.catch(async (err) => {
					// 	if we can't send the player link confirmation message, let's make an error
					// 	in the error logs channel so we have context around what is being thrown
					await gracefullyHandleError(
						new Error(
							'Error sending player link confirmation message.  The next error message is the error that was thrown.',
						),
					);
					// 	still throw the error so it is logged
					throw new Error(err);
				});
		}
	}
}
