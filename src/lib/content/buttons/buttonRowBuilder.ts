import { ButtonInteractionTypes, buttonBuilder } from './buttonBuilder';

export enum CommandTypes {
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
	[key in CommandTypes]: {
		active: ButtonInteractionTypes;
		inactive: ButtonInteractionTypes;
	}[];
} = {
	[CommandTypes.watch]: [
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
	[CommandTypes.list]: [
		{
			active: ButtonInteractionTypes.UserSnoozeActive,
			inactive: ButtonInteractionTypes.UserSnoozeInactive,
		},
		{
			active: ButtonInteractionTypes.GlobalRefreshActive,
			inactive: ButtonInteractionTypes.GlobalRefreshInactive,
		},
	],
	[CommandTypes.block]: [
		{
			active: ButtonInteractionTypes.GlobalUnblockActive,
			inactive: ButtonInteractionTypes.GlobalUnblockInactive,
		},
	],
	[CommandTypes.blocks]: [],
	[CommandTypes.help]: [],
	[CommandTypes.snooze]: [],
	[CommandTypes.unblock]: [
		{
			active: ButtonInteractionTypes.GlobalUnblockActive,
			inactive: ButtonInteractionTypes.GlobalUnblockInactive,
		},
	],
	[CommandTypes.unsnooze]: [],
	[CommandTypes.unwatch]: [],
	[CommandTypes.watches]: [],
	[CommandTypes.link]: [
		{
			active: ButtonInteractionTypes.UnlinkCharacterActive,
			inactive: ButtonInteractionTypes.UnlinkCharacterInactive,
		},
	],
	[CommandTypes.unlink]: [
		{
			active: ButtonInteractionTypes.UnlinkCharacterActive,
			inactive: ButtonInteractionTypes.UnlinkCharacterInactive,
		},
	],
	[CommandTypes.watchNotification]: [
		{
			active: ButtonInteractionTypes.WatchSnoozeActive,
			inactive: ButtonInteractionTypes.WatchSnoozeInactive,
		},
		{
			active: ButtonInteractionTypes.UnwatchActive,
			inactive: ButtonInteractionTypes.UnwatchInactive,
		},
		{
			active: ButtonInteractionTypes.WatchBlockActive,
			inactive: ButtonInteractionTypes.WatchBlockInactive,
		},
		{
			active: ButtonInteractionTypes.WatchRefreshActive,
			inactive: ButtonInteractionTypes.WatchRefreshInactive,
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
	commandType: CommandTypes,
	activeButtons = [false, false, false],
) {
	const mappings = commandTypeButtonMappings[commandType];
	if (!mappings) {
		throw new Error('Invalid command type.');
	}

	const buttonTypes = mappings.map((mapping, index) =>
		getButtonType(activeButtons[index], mapping),
	);

	console.log('buttonTypes = ', buttonTypes)

	return buttonBuilder(buttonTypes.map((type) => ({ type })));
}
