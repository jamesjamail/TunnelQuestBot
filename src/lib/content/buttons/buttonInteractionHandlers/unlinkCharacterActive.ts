import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PlayerLink } from '@prisma/client';
import { insertPlayerLinkFull } from '../../../../prisma/dbExecutors';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';
import { playerlinkCommandResponseBuilder } from '../../messages/messageBuilder';
import { messageCopy } from '../../copy/messageCopy';

export default async function handleUnlinkCharacterActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	// TODO: This should "re-link" a player to a discord user.
	const link = metadata as PlayerLink;
	const data = await insertPlayerLinkFull(link);
	const components = buttonRowBuilder(CommandTypes.link, [false]);
	const embeds = [playerlinkCommandResponseBuilder(data) as EmbedBuilder];
	await interaction.update({
		content: messageCopy.soAndSoHasBeenLinked(data),
		embeds,
		components,
	});
}
