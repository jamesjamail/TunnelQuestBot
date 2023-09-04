import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

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
    WatchUnblockActive,
    WatchUnblockInactive,
    WatchNotificationSnoozeActive,
    WatchNotificationSnoozeInactive,
    WatchNotificationUnwatchActive,
    WatchNotificationUnwatchInactive,
    WatchNotificationWatchRefreshActive,
    WatchNotificationWatchRefreshInactive,
}


type ButtonConfig = {
    type: ButtonInteractionTypes;
};

export function buttonBuilder(buttonsToBuild: ButtonConfig[]) {
    const row = new ActionRowBuilder<ButtonBuilder>();

    const buttons = buttonsToBuild.map((buttonConfig) => {
        const isActive = ButtonInteractionTypes[buttonConfig.type].endsWith("Active");
        const builder = new ButtonBuilder().setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary);

        switch (true) {  // Using switch(true) to group together possible results
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchSnooze"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("UserSnooze"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchNotificationSnooze"):
                builder.setCustomId(ButtonInteractionTypes[buttonConfig.type]).setLabel("💤");
                break;
            case ButtonInteractionTypes[buttonConfig.type].startsWith("Unwatch"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchNotificationUnwatch"):
                builder.setCustomId(ButtonInteractionTypes[buttonConfig.type]).setLabel("❌");
                if (isActive) {
                    builder.setStyle(ButtonStyle.Danger);
                }
                break;
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchRefresh"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("GlobalRefresh"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchNotificationWatchRefresh"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("GlobalUnblock"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchBlock"):
            case ButtonInteractionTypes[buttonConfig.type].startsWith("WatchUnblock"):
                builder.setCustomId(ButtonInteractionTypes[buttonConfig.type]).setLabel("♻️");
                break;
            default:
                throw new Error(`No button type defined for: ${ButtonInteractionTypes[buttonConfig.type]}`);
        }

        return builder;
    });

    row.addComponents(buttons);
    return [row];
}
