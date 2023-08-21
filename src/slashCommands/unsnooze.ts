import { SlashCommandBuilder } from "discord.js"
import { SlashCommand } from "../types";

const command: SlashCommand = {
    command: new SlashCommandBuilder()
        .setName("unsnooze")
        .setDescription("unsnooze a player")
    ,
    execute: interaction => {
        interaction.reply({
            content: "unsnooze a player",
        })
    },
    cooldown: 10
}

export default command