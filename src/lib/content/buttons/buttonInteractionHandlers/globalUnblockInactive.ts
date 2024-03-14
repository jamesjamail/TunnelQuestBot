import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { removePlayerBlockById } from '../../../../prisma/dbExecutors/block';
import { blockCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

export default async function handleGlobalUnblockInactive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id } = metadata as BlockedPlayer;
	const data = await removePlayerBlockById(id);
	const embeds = [blockCommandResponseBuilder(data)];
	const components = buttonRowBuilder(MessageTypes.block, [true]);
	await interaction.update({
		content: messageCopy.soAndSoHasBeenUnblocked(data),
		embeds,
		components,
	});
	debug_console(messageCopy.soAndSoHasBeenUnblocked(data));
}
