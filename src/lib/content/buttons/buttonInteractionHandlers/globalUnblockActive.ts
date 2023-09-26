import { BlockedPlayer } from '@prisma/client';
import { ButtonInteraction } from 'discord.js';
import { addPlayerBlock } from '../../../../prisma/dbExecutors';
import { messageCopy } from '../../copy/messageCopy';
import { blockCommandResponseBuilder } from '../../messages/messageBuilder';
import { buttonRowBuilder, CommandTypes } from '../buttonRowBuilder';

export default async function handleGlobalUnblockActive<T>(
	interaction: ButtonInteraction,
	metadata: T,
) {
	const { player, server } = metadata as BlockedPlayer;
	const data = await addPlayerBlock(interaction.user.id, player, server);
	const components = buttonRowBuilder(CommandTypes.block, [false]);
	const embeds = [blockCommandResponseBuilder(data)];
	await interaction.update({
		content: messageCopy.soAndSoHasBeenBlocked(data),
		embeds,
		components,
	});
}
