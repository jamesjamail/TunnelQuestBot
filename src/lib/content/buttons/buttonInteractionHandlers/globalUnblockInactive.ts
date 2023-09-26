import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { removePlayerBlockById } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { blockCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleGlobalUnblockInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id } = metadata as BlockedPlayer;
	const data = await removePlayerBlockById(id);
	const components = buttonRowBuilder(CommandTypes.block, [true]);
	const embeds = [blockCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.soAndSoHasBeenUnblocked(data),
		embeds,
		components,
	});
}
