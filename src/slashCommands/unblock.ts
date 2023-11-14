import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../types';
import { messageCopy } from '../lib/content/copy/messageCopy';
import { autoCompletePlayerNameOptions } from '../lib/content/commandOptions/commandOptions';
import { autocompleteBlocks } from '../lib/helpers/autocomplete';
import { BlockedPlayer } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../lib/content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../lib/content/buttons/buttonRowBuilder';
import { blockCommandResponseBuilder } from '../lib/content/messages/messageBuilder';
import { getInteractionArgs } from '../lib/helpers/helpers';
import {
	removePlayerBlockById,
	removePlayerBlockWithoutServer,
} from '../prisma/dbExecutors';

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('unblock')
		.setDescription('unblock a player')
		.addStringOption(
			autoCompletePlayerNameOptions,
		) as unknown as SlashCommandBuilder,
	async autocomplete(interaction) {
		await autocompleteBlocks(interaction);
	},
	execute: async (interaction) => {
		const args = getInteractionArgs(interaction, ['player']);
		if (args?.watch?.isAutoSuggestion) {
			const metadata = args?.player?.autoSuggestionMetaData
				?.player as BlockedPlayer;
			const block = await removePlayerBlockById(metadata.id);

			const embeds = [blockCommandResponseBuilder(block)];
			const components = buttonRowBuilder(MessageTypes.block, [
				false,
				true,
				false,
			]);
			const response = await interaction.reply({
				content: messageCopy.soAndSoHasBeenUnblocked(metadata),
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				block,
			);
		} else {
			// make a good faith effort to unwatch based on raw string
			// TODO: if no block found, this will throw.  catch it and respond accordingly
			const playerName = args?.player?.value;
			const block = await removePlayerBlockWithoutServer(
				interaction,
				playerName as string, //	TODO: fix type error
			);

			const embeds = [blockCommandResponseBuilder(block)];
			const components = buttonRowBuilder(MessageTypes.watch, [
				false,
				true,
				false,
			]);
			const response = await interaction.reply({
				content: messageCopy.yourWatchHasBeenUnwatched,
				embeds,
				components,
			});

			return await collectButtonInteractionAndReturnResponse(
				response,
				block,
			);
		}
	},
	cooldown: 10,
};

export default command;
