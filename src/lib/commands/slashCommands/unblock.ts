import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../../types';
import { messageCopy } from '../../content/copy/messageCopy';
import { autoCompletePlayerNameOptions } from '../commandOptions';
import { BlockedPlayer } from '@prisma/client';
import { collectButtonInteractionAndReturnResponse } from '../../content/buttons/buttonInteractionCollector';
import {
	buttonRowBuilder,
	MessageTypes,
} from '../../content/buttons/buttonRowBuilder';
import { blockCommandResponseBuilder } from '../../content/messages/messageBuilder';
import {
	removePlayerBlockById,
	removePlayerBlockWithoutServer,
} from '../../../prisma/dbExecutors/block';
import { autocompleteBlocks } from '../autocomplete/autocompleteBlocks';
import { getInteractionArgs } from '../getInteractionsArgs';
import { gracefullyHandleError } from '../../helpers/errors';

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
		try {
			const args = getInteractionArgs(interaction, ['player']);
			if (args?.player?.isAutoSuggestion) {
				const metadata = args?.player?.autoSuggestionMetaData
					?.blockedPlayer as BlockedPlayer;

				const block = await removePlayerBlockById(metadata.id);

				// we've encountered issues with the JSON metadata exceeding 100 characters.
				// due to this, we are now only storing crucial data in the metadata, for /unblock
				// this is simply the block id.  In order to populate the full response message,
				// we need to backfill the additional info
				metadata.player = block.player;
				metadata.server = block.server;

				const embeds = [blockCommandResponseBuilder(block)];
				const components = buttonRowBuilder(MessageTypes.block, [
					true,
					true,
					false,
				]);
				const response = await interaction.reply({
					content: messageCopy.soAndSoHasBeenUnblocked(metadata),
					embeds,
					components,
					ephemeral: true,
				});

				return await collectButtonInteractionAndReturnResponse(
					response,
					block,
				);
			} else {
				// make a good faith effort to unblock based on raw string
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
					content: messageCopy.soAndSoHasBeenUnblocked(block),
					embeds,
					components,
					ephemeral: true,
				});

				return await collectButtonInteractionAndReturnResponse(
					response,
					block,
				);
			}
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
