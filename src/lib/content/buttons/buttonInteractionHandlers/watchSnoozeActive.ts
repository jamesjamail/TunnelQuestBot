import { Watch } from "@prisma/client";
import { ButtonInteraction } from "discord.js";
import { unsnoozeWatch } from "../../../helpers/dbExecutors";
import { messageCopy } from "../../copy/messageCopy";
import { watchCommandResponseBuilder } from "../../messages/messageBuilder";
import { buttonRowBuilder, CommandTypes } from "../buttonRowBuilder";

export default async function handleWatchSnoozeActive(interaction: ButtonInteraction, metadata: Watch) {
    const data = await unsnoozeWatch(metadata);
    const components = buttonRowBuilder(CommandTypes.watch, [false, false, false]);
    const embeds = [watchCommandResponseBuilder(data)];
    await interaction.reply({ content: messageCopy.yourWatchHasBeenUnoozed, embeds, components });
}