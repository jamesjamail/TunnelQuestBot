import command from '../src/slashCommands/help';
import {
	executeCommandAndSpyReply,
	embedContaining,
	getParsedCommand,
} from '../tests/testUtils';

describe('Help Command', () => {
	it('replies with help message', async () => {
		const stringCommand = '/help';
		const parsedCommand = getParsedCommand(stringCommand, command);
		const spy = await executeCommandAndSpyReply(command, parsedCommand);
		expect(spy).toHaveBeenCalledWith(
			// TODO: help is a non-embedded message
			embedContaining({
				color: 0xffff00,
				title: ':crescent_moon: About Corvo Astral',
			}),
		);
	});
});
