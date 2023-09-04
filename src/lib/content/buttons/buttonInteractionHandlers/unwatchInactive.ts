import { Watch } from "@prisma/client";
import { ButtonInteraction } from "discord.js";
import { unwatch } from "../../../helpers/dbExecutors";
import { messageCopy } from "../../copy/messageCopy";
import { watchCommandResponseBuilder } from "../../messages/messageBuilder";
import { buttonRowBuilder, CommandTypes } from "../buttonRowBuilder";

export default async function handleUnwatchInactive(interaction: ButtonInteraction, metadata: Watch) {
    const data = await unwatch(metadata);
    console.log(data)
    const isSnoozed = !!data.snoozedWatches.length;
    const components = buttonRowBuilder(CommandTypes.watch, [isSnoozed, true, false]);
    const embeds = [watchCommandResponseBuilder(data)];
    await interaction.reply({ content: messageCopy.yourWatchHasBeenUnwatched, embeds, components });
}