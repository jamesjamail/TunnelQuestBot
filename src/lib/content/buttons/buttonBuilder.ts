import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export enum ButtonInteractionTypes {
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
	WatchNotificationSnoozeActive,
	WatchNotificationSnoozeInactive,
	WatchNotificationUnwatchActive,
	WatchNotificationUnwatchInactive,
	WatchNotificationWatchRefreshActive,
	WatchNotificationWatchRefreshInactive,
	UnlinkCharacterActive,
	UnlinkCharacterInactive,
}

type ButtonConfig = {
	type: ButtonInteractionTypes;
	entityId?: string;
};

export function parseCustomId(customId: string): {
	actionType: string;
	entityId?: string;
	extra?: string;
} {
	const [actionType, entityId, ...rest] = customId.split(':');
	return {
		actionType,
		entityId: entityId || undefined,
		extra: rest.length > 0 ? rest.join(':') : undefined,
	};
}

export function buttonBuilder(buttonsToBuild: ButtonConfig[]) {
	const row = new ActionRowBuilder<ButtonBuilder>();

	const buttons = buttonsToBuild.map((buttonConfig) => {
		const typeName = ButtonInteractionTypes[buttonConfig.type];
		const isActive = typeName.endsWith('Active');
		const customId = buttonConfig.entityId
			? `${typeName}:${buttonConfig.entityId}`
			: typeName;
		const builder = new ButtonBuilder().setStyle(
			isActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
		);

		switch (true) {
			case typeName.startsWith('WatchSnooze'):
			case typeName.startsWith('UserSnooze'):
			case typeName.startsWith('WatchNotificationSnooze'):
				builder.setCustomId(customId).setLabel('💤');
				break;
			case typeName.startsWith('Unwatch'):
			case typeName.startsWith('GlobalUnblock'):
			case typeName.startsWith('WatchNotificationUnwatch'):
				builder.setCustomId(customId).setLabel('❌');
				if (isActive) {
					builder.setStyle(ButtonStyle.Danger);
				}
				break;
			case typeName.startsWith('WatchRefresh'):
			case typeName.startsWith('GlobalRefresh'):
			case typeName.startsWith('WatchNotificationWatchRefresh'):
				builder.setCustomId(customId).setLabel('♻️');
				break;
			case typeName.startsWith('UnlinkCharacter'):
				builder
					.setCustomId(customId)
					.setLabel(isActive ? 'Relink' : 'Unlink')
					.setStyle(
						isActive ? ButtonStyle.Success : ButtonStyle.Secondary,
					);
				break;
			case typeName.startsWith('WatchBlock'):
				builder
					.setCustomId(customId)
					.setLabel('🔕')
					.setStyle(
						isActive ? ButtonStyle.Success : ButtonStyle.Secondary,
					);
				break;

			default:
				throw new Error(`No button type defined for: ${typeName}`);
		}

		return builder;
	});

	row.addComponents(buttons);
	return [row];
}
