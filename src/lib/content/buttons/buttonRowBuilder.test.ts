import { describe, it, expect } from 'vitest';
import { buttonRowBuilder, MessageTypes } from './buttonRowBuilder';

function customIdsFor(
	commandType: MessageTypes,
	activeButtons?: boolean[],
	entityId?: string,
) {
	const rows = buttonRowBuilder(commandType, activeButtons, entityId);
	return rows.flatMap((row) =>
		row.components.map((button) => button.toJSON().custom_id),
	);
}

describe('buttonRowBuilder', () => {
	it.each([
		[MessageTypes.watch, 3],
		[MessageTypes.list, 2],
		[MessageTypes.block, 1],
		[MessageTypes.unblock, 1],
		[MessageTypes.link, 1],
		[MessageTypes.unlink, 1],
		[MessageTypes.watchNotification, 4],
		[MessageTypes.blocks, 0],
		[MessageTypes.help, 0],
		[MessageTypes.snooze, 0],
		[MessageTypes.unsnooze, 0],
		[MessageTypes.unwatch, 0],
		[MessageTypes.watches, 0],
	])('MessageTypes.%s produces %i buttons', (messageType, count) => {
		expect(customIdsFor(messageType)).toHaveLength(count);
	});

	it('selects active and inactive buttons per slot', () => {
		expect(customIdsFor(MessageTypes.watch, [true, false, false])).toEqual([
			'WatchSnoozeActive',
			'UnwatchInactive',
			'WatchRefreshInactive',
		]);
	});

	it('defaults activeButtons to all inactive', () => {
		expect(customIdsFor(MessageTypes.watch)).toEqual([
			'WatchSnoozeInactive',
			'UnwatchInactive',
			'WatchRefreshInactive',
		]);
	});

	it('propagates entityId to every button customId', () => {
		expect(
			customIdsFor(MessageTypes.watch, [false, false, false], '7'),
		).toEqual([
			'WatchSnoozeInactive:7',
			'UnwatchInactive:7',
			'WatchRefreshInactive:7',
		]);
	});

	it('throws for an invalid command type', () => {
		expect(() => buttonRowBuilder(99 as MessageTypes)).toThrow(
			'Invalid command type.',
		);
	});
});
