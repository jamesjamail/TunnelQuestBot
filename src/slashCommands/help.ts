import { SlashCommandBuilder } from "discord.js"
import { SlashCommand } from "../types";
import { helpMsg } from "../content/messageResponseCopy";

const command: SlashCommand = {
    command: new SlashCommandBuilder()
        .setName("help")
        .setDescription("show command information")
    ,
    execute: interaction => {
        interaction.reply({
            content: helpMsg,
        })
    },
    cooldown: 10
}

export default command