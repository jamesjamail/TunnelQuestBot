import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../../types';
import { messageCopy } from '../../content/copy/messageCopy';
import { gracefullyHandleError } from '../../helpers/errors';

const MAX_MESSAGE_LENGTH = 2000;

// 	the help text is longer than one message can hold; its sections are
// 	separated by blank lines, so that is where it is cut
function splitAtSectionBreaks(text: string): string[] {
	const messages: string[] = [];
	let current = '';
	for (const section of text.split('\n\n')) {
		const next = current ? `${current}\n\n${section}` : section;
		if (current && next.length > MAX_MESSAGE_LENGTH) {
			messages.push(current);
			current = section;
		} else {
			current = next;
		}
	}
	if (current) messages.push(current);
	return messages;
}

const command: SlashCommand = {
	command: new SlashCommandBuilder()
		.setName('help')
		.setDescription('show command information'),
	execute: async (interaction) => {
		try {
			const [first, ...rest] = splitAtSectionBreaks(messageCopy.helpMsg);
			await interaction.reply({
				content: first,
				flags: MessageFlags.Ephemeral,
			});
			for (const content of rest) {
				await interaction.followUp({
					content,
					flags: MessageFlags.Ephemeral,
				});
			}
		} catch (error) {
			await gracefullyHandleError(error, interaction, command);
		}
	},
	cooldown: 10,
};

export default command;
