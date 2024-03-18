import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { messageCopy } from '../../copy/messageCopy';
import { restorePlayerBlockById } from '../../../../prisma/dbExecutors/block';
import { blockCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, MessageTypes } from '../buttonRowBuilder';

export default async function handleGlobalUnblockActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { id } = metadata as BlockedPlayer;
	const data = await restorePlayerBlockById(id);
	const embeds = [blockCommandResponseBuilder(data)];
	const components = buttonRowBuilder(MessageTypes.block);
	await interaction.update({
		content: messageCopy.soAndSoHasBeenBlocked(data),
		embeds,
		components,
	});
	debug_console(messageCopy.soAndSoHasBeenBlocked(data));
}
