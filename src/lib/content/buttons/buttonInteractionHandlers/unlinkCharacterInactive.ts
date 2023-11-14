import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { confirmButtonInteraction } from '../../../helpers/buttons';
import { PlayerLink } from '@prisma/client';
import { removePlayerLinkById } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';
import { playerlinkCommandResponseBuilder } from '../../messages/messageBuilder';

export default async function handleUnlinkCharacterInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	// TODO: This should "unlink" a player from a discord user.
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			const link = metadata as PlayerLink;
			const success = await removePlayerLinkById(link.id);
			await followUpMessage.delete();
			let new_embed = playerlinkCommandResponseBuilder(
				link,
			) as EmbedBuilder;
			if (success) {
				new_embed = new_embed
					.setColor('NotQuiteBlack')
					.setTitle(`⛓️‍💥 ${new_embed.data.title}`);
				await interaction.editReply({
					content: messageCopy.soAndSoHasBeenUnlinked(link),
					embeds: [new_embed],
					components: buttonRowBuilder(MessageTypes.link, [true]),
				});
			} else {
				await interaction.editReply({
					content: messageCopy.soAndSoHasFailedToBeUnlinked(link),
					embeds: [new_embed],
					components: buttonRowBuilder(MessageTypes.link, [false]),
				});
			}
		},
		'Are you sure wish to unlink this character?',
		MessageTypes.unlink,
	);
}
