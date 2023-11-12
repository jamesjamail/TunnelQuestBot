import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// eslint-disable-next-line no-shadow
export enum ButtonInteractionTypes {
	ConfirmActionActive,
	ConfirmActionInactive,
	CancelActionActive,
	CancelActionInactive,
	WatchSnoozeActive,
	WatchSnoozeInactive,
	UserSnoozeActive,
	UserSnoozeInactive,
	UnwatchActive,
	UnwatchInactive,
	WatchRefreshActive,
	WatchRefreshInactive,
	GlobalRefreshActive,
	GlobalRefreshInactive,
	GlobalUnblockActive,
	GlobalUnblockInactive,
	WatchBlockActive,
	WatchBlockInactive,
	WatchUnblockActive,
	WatchUnblockInactive,
	WatchNotificationSnoozeActive,
	WatchNotificationSnoozeInactive,
	WatchNotificationUnwatchActive,
	WatchNotificationUnwatchInactive,
	WatchNotificationWatchRefreshActive,
	WatchNotificationWatchRefreshInactive,
	UnlinkCharacterActive,
	UnlinkCharacterInactive,
	watchNotification,
}

type ButtonConfig = {
	type: ButtonInteractionTypes;
};

export function buttonBuilder(buttonsToBuild: ButtonConfig[]) {
	const row = new ActionRowBuilder<ButtonBuilder>();

	const buttons = buttonsToBuild.map((buttonConfig) => {
		const isActive =
			ButtonInteractionTypes[buttonConfig.type].endsWith('Active');
		const builder = new ButtonBuilder().setStyle(
			isActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
		);

		switch (true) {
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchSnooze',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'UserSnooze',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchNotificationSnooze',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('💤');
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'Unwatch',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'GlobalUnblock',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchNotificationUnwatch',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('❌');
				if (isActive) {
					builder.setStyle(ButtonStyle.Danger);
				}
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchRefresh',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'GlobalRefresh',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchNotificationWatchRefresh',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchBlock',
			):
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'WatchUnblock',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('♻️');
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'ConfirmAction',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('Confirm')
					.setStyle(
						isActive ? ButtonStyle.Success : ButtonStyle.Secondary,
					);
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'CancelAction',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('Cancel')
					.setStyle(
						isActive ? ButtonStyle.Danger : ButtonStyle.Secondary,
					);
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'UnlinkCharacter',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel(
						ButtonInteractionTypes[buttonConfig.type].endsWith(
							'Active',
						)
							? 'Relink'
							: 'Unlink',
					)
					.setStyle(
						isActive ? ButtonStyle.Success : ButtonStyle.Secondary,
					);
				break;
			case ButtonInteractionTypes[buttonConfig.type].startsWith(
				'watchBlock',
			):
				builder
					.setCustomId(ButtonInteractionTypes[buttonConfig.type])
					.setLabel('🔕')
					.setStyle(
						isActive ? ButtonStyle.Success : ButtonStyle.Secondary,
					);
				break;

			default:
				throw new Error(
					`No button type defined for: ${
						ButtonInteractionTypes[buttonConfig.type]
					}`,
				);
		}

		return builder;
	});

	row.addComponents(buttons);
	return [row];
}
