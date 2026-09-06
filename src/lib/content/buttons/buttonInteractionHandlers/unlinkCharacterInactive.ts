import type { ButtonInteraction, EmbedBuilder } from 'discord.js';
import type { PlayerLink } from '../../../../prisma/client';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { playerlinkCommandResponseBuilder } from '../../messages/messageBuilder';
import { removePlayerLinkById } from '../../../../prisma/dbExecutors/playerLink';
import { debug } from '../../../helpers/logger';

export default async function handleUnlinkCharacterInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const link = metadata as PlayerLink;
	const success = await removePlayerLinkById(link.id);
	let new_embed = playerlinkCommandResponseBuilder(link) as EmbedBuilder;
	let message: string;
	if (success) {
		new_embed = new_embed
			.setColor('NotQuiteBlack')
			.setTitle(`⛓️‍💥 ${new_embed.data.title}`);
		message = messageCopy.soAndSoHasBeenUnlinked(link);
		await interaction.update({
			content: message,
			embeds: [new_embed],
			components: buttonRowBuilder(
				MessageTypes.link,
				[true],
				String(link.id),
			),
		});
	} else {
		message = messageCopy.soAndSoHasFailedToBeUnlinked(link);
		await interaction.update({
			content: message,
			embeds: [new_embed],
			components: buttonRowBuilder(
				MessageTypes.link,
				[false],
				String(link.id),
			),
		});
	}
	debug(message);
}
