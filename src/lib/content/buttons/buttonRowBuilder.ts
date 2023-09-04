import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ButtonInteractionTypes, buttonBuilder } from "./buttonBuilder";

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
}

export function buttonRowBuilder(commandType: CommandTypes, activeButtons = [false, false, false]) {
    switch (commandType) {
        case CommandTypes.watch:
            const buttonTypes = [
                activeButtons[0] ? ButtonInteractionTypes.WatchSnoozeActive : ButtonInteractionTypes.WatchSnoozeInactive,
                activeButtons[1] ? ButtonInteractionTypes.UnwatchActive : ButtonInteractionTypes.UnwatchInactive,
                activeButtons[2] ? ButtonInteractionTypes.WatchRefreshActive : ButtonInteractionTypes.WatchRefreshInactive
            ];
            return buttonBuilder(buttonTypes.map(type => ({ type })));
        case CommandTypes.blocks:
        default:
            throw new Error('Invalid command type.');
    }
}