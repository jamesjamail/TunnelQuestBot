import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PlayerLink } from '@prisma/client';
import { insertPlayerLinkFull } from '@src/prisma/dbExecutors';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { playerlinkCommandResponseBuilder } from '@src/lib/content/messages/messageBuilder';
import { messageCopy } from '@src/lib/content/copy/messageCopy';

export default async function handleUnlinkCharacterActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	// TODO: This should "re-link" a player to a discord user.
	const link = metadata as PlayerLink;
	const data = await insertPlayerLinkFull(link);
	const components = buttonRowBuilder(MessageTypes.link, [false]);
	const embeds = [playerlinkCommandResponseBuilder(data) as EmbedBuilder];
	await interaction.update({
		content: messageCopy.soAndSoHasBeenLinked(data),
		embeds,
		components,
	});
}
