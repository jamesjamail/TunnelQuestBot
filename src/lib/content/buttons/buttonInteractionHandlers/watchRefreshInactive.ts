import { Watch } from "@prisma/client";
import { ButtonInteraction } from "discord.js";
import { extendWatch, unwatch, upsertWatch } from "../../../helpers/dbExecutors";
import { messageCopy } from "../../copy/messageCopy";
import { watchCommandResponseBuilder } from "../../messages/messageBuilder";
import { buttonRowBuilder, CommandTypes } from "../buttonRowBuilder";

export default async function handleWatchRefreshInactive(interaction: ButtonInteraction, metadata: Watch) {
    const data = await extendWatch(metadata);
    console.log(data)
    const isSnoozed = !!data.snoozedWatches.length;
    const components = buttonRowBuilder(CommandTypes.watch, [isSnoozed, false, true]);
    const embeds = [watchCommandResponseBuilder(data)];
    await interaction.reply({ content: messageCopy.yourWatchHasBeenExtended, embeds, components });
}