import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

//	const object rather than `enum` so the syntax stays erasable - see the note
//	on AuctionTypes in lib/parser/parser.ts. Values are the member names because
//	they are written into button customIds and parsed back out of them; the old
//	numeric enum produced the same strings via reverse mapping.
export const ButtonInteractionTypes = {
	WatchSnoozeActive: 'WatchSnoozeActive',
	WatchSnoozeInactive: 'WatchSnoozeInactive',
	UserSnoozeActive: 'UserSnoozeActive',
	UserSnoozeInactive: 'UserSnoozeInactive',
	UnwatchActive: 'UnwatchActive',
	UnwatchInactive: 'UnwatchInactive',
	WatchRefreshActive: 'WatchRefreshActive',
	WatchRefreshInactive: 'WatchRefreshInactive',
	GlobalRefreshActive: 'GlobalRefreshActive',
	GlobalRefreshInactive: 'GlobalRefreshInactive',
	GlobalUnblockActive: 'GlobalUnblockActive',
	GlobalUnblockInactive: 'GlobalUnblockInactive',
	WatchBlockActive: 'WatchBlockActive',
	WatchBlockInactive: 'WatchBlockInactive',
	WatchNotificationSnoozeActive: 'WatchNotificationSnoozeActive',
	WatchNotificationSnoozeInactive: 'WatchNotificationSnoozeInactive',
	WatchNotificationUnwatchActive: 'WatchNotificationUnwatchActive',
	WatchNotificationUnwatchInactive: 'WatchNotificationUnwatchInactive',
	WatchNotificationWatchRefreshActive: 'WatchNotificationWatchRefreshActive',
	WatchNotificationWatchRefreshInactive:
		'WatchNotificationWatchRefreshInactive',
	UnlinkCharacterActive: 'UnlinkCharacterActive',
	UnlinkCharacterInactive: 'UnlinkCharacterInactive',
} as const;

export type ButtonInteractionTypes =
	(typeof ButtonInteractionTypes)[keyof typeof ButtonInteractionTypes];

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
		//	the member value is the name, so no reverse lookup is needed
		const typeName = buttonConfig.type;
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
