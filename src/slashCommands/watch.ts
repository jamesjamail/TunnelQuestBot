import { SlashCommandBuilder } from "discord.js"
import { SlashCommand } from "../types";

const command: SlashCommand = {
    command: new SlashCommandBuilder()
        .setName("watch")
        .setDescription("create or modify a watch")
    ,
    execute: interaction => {
        interaction.reply({
            content: "watch",
        })
    },
    cooldown: 10
}

export default command