import { describe, it, expect } from 'vitest';

import help from './help';
import version from './version';
import link from './link';
import unlink from './unlink';
import block from './block';
import unblock from './unblock';
import list from './list';
import blocks from './blocks';
import links from './links';
import watch from './watch';
import unwatch from './unwatch';
import watches from './watches';
import getWatch from './getWatch';
import snooze from './snooze';
import unsnooze from './unsnooze';

const commands = [
	{ module: help, name: 'help', autocomplete: false },
	{ module: version, name: 'version', autocomplete: false },
	{ module: link, name: 'link', autocomplete: false },
	{ module: unlink, name: 'unlink', autocomplete: false },
	{ module: block, name: 'block', autocomplete: false },
	{ module: unblock, name: 'unblock', autocomplete: true },
	{ module: list, name: 'list', autocomplete: false },
	{ module: blocks, name: 'blocks', autocomplete: false },
	{ module: links, name: 'links', autocomplete: false },
	{ module: watch, name: 'watch', autocomplete: true },
	{ module: unwatch, name: 'unwatch', autocomplete: true },
	{ module: watches, name: 'watches', autocomplete: false },
	{ module: getWatch, name: 'get', autocomplete: true },
	{ module: snooze, name: 'snooze', autocomplete: true },
	{ module: unsnooze, name: 'unsnooze', autocomplete: true },
] as const;

describe('slash command contract', () => {
	it.each(commands)(
		'$name exports command metadata and execute',
		({ module: commandModule, name, autocomplete }) => {
			expect(commandModule.command.name).toBe(name);
			expect(typeof commandModule.execute).toBe('function');
			expect(typeof commandModule.cooldown).toBe('number');

			if (autocomplete) {
				expect(typeof commandModule.autocomplete).toBe('function');
			} else {
				expect(commandModule.autocomplete).toBeUndefined();
			}
		},
	);
});
