import { CommandInteraction } from 'discord.js';
import MockDiscord from './mockDiscord';

/* Spy 'reply' */
export function mockInteractionAndSpyReply(command) {
	const discord = new MockDiscord({ command });
	const interaction = discord.getInteraction() as CommandInteraction;
	const spy = jest.spyOn(interaction, 'reply');
	return { interaction, spy };
}

export async function executeCommandAndSpyReply(command, content, config = {}) {
	const { interaction, spy } = mockInteractionAndSpyReply(content);
	const commandInstance = new command(interaction, {
		...defaultConfig,
		...config,
	});
	await commandInstance.execute();
	return spy;
}
