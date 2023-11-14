import { ButtonInteractionTypes, buttonBuilder } from './buttonBuilder';

export enum MessageTypes {
	block,
	blocks,
	help,
	list,
	snooze,
	unblock,
	unsnooze,
	unwatch,
	watch,
	watches,
	link,
	unlink,
	watchNotification,
}

const commandTypeButtonMappings: {
	[key in MessageTypes]: {
		active: ButtonInteractionTypes;
		inactive: ButtonInteractionTypes;
	}[];
} = {
	[MessageTypes.watch]: [
		{
			active: ButtonInteractionTypes.WatchSnoozeActive,
			inactive: ButtonInteractionTypes.WatchSnoozeInactive,
		},
		{
			active: ButtonInteractionTypes.UnwatchActive,
			inactive: ButtonInteractionTypes.UnwatchInactive,
		},
		{
			active: ButtonInteractionTypes.WatchRefreshActive,
			inactive: ButtonInteractionTypes.WatchRefreshInactive,
		},
	],
	[MessageTypes.list]: [
		{
			active: ButtonInteractionTypes.UserSnoozeActive,
			inactive: ButtonInteractionTypes.UserSnoozeInactive,
		},
		{
			active: ButtonInteractionTypes.GlobalRefreshActive,
			inactive: ButtonInteractionTypes.GlobalRefreshInactive,
		},
	],
	[MessageTypes.block]: [
		{
			active: ButtonInteractionTypes.GlobalUnblockActive,
			inactive: ButtonInteractionTypes.GlobalUnblockInactive,
		},
	],
	[MessageTypes.blocks]: [],
	[MessageTypes.help]: [],
	[MessageTypes.snooze]: [],
	[MessageTypes.unblock]: [
		{
			active: ButtonInteractionTypes.GlobalUnblockActive,
			inactive: ButtonInteractionTypes.GlobalUnblockInactive,
		},
	],
	[MessageTypes.unsnooze]: [],
	[MessageTypes.unwatch]: [],
	[MessageTypes.watches]: [],
	[MessageTypes.link]: [
		{
			active: ButtonInteractionTypes.UnlinkCharacterActive,
			inactive: ButtonInteractionTypes.UnlinkCharacterInactive,
		},
	],
	[MessageTypes.unlink]: [
		{
			active: ButtonInteractionTypes.UnlinkCharacterActive,
			inactive: ButtonInteractionTypes.UnlinkCharacterInactive,
		},
	],
	[MessageTypes.watchNotification]: [
		{
			active: ButtonInteractionTypes.WatchNotificationSnoozeActive,
			inactive: ButtonInteractionTypes.WatchNotificationSnoozeInactive,
		},
		{
			active: ButtonInteractionTypes.WatchNotificationUnwatchActive,
			inactive: ButtonInteractionTypes.WatchNotificationUnwatchInactive,
		},
		{
			active: ButtonInteractionTypes.WatchBlockActive,
			inactive: ButtonInteractionTypes.WatchBlockInactive,
		},
		{
			active: ButtonInteractionTypes.WatchNotificationWatchRefreshActive,
			inactive:
				ButtonInteractionTypes.WatchNotificationWatchRefreshInactive,
		},
	],
};

function getButtonType(
	active: boolean,
	mapping: {
		active: ButtonInteractionTypes;
		inactive: ButtonInteractionTypes;
	},
): ButtonInteractionTypes {
	return active ? mapping.active : mapping.inactive;
}

export function buttonRowBuilder(
	commandType: MessageTypes,
	activeButtons = [false, false, false],
) {
	const mappings = commandTypeButtonMappings[commandType];
	if (!mappings) {
		throw new Error('Invalid command type.');
	}

	const buttonTypes = mappings.map((mapping, index) =>
		getButtonType(activeButtons[index], mapping),
	);

	return buttonBuilder(buttonTypes.map((type) => ({ type })));
}
