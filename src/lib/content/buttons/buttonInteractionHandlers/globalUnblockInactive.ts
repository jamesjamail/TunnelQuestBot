import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { MessageTypes } from '../buttonRowBuilder';
import { confirmButtonInteraction } from '../buttonHelpers';
import { removePlayerBlockById } from '../../../../prisma/dbExecutors/block';

export default async function handleGlobalUnblockInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	return await confirmButtonInteraction(
		interaction,
		async (followUpMessage) => {
			const { id } = metadata as BlockedPlayer;
			const data = await removePlayerBlockById(id);
			await followUpMessage.delete();
			await interaction.editReply({
				content: messageCopy.soAndSoHasBeenUnblocked(data),
				embeds: [],
				components: [],
			});
		},
		'Are you sure wish to unblock this player?',
		MessageTypes.unblock,
	);
}
