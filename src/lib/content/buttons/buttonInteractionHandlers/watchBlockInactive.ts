import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { removePlayerBlockById } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { confirmButtonInteraction } from '../../../helpers/buttons';
import { CommandTypes } from '../buttonRowBuilder';

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
		'Are you sure wish to unblock?',
		CommandTypes.watchNotification,
	);
}
