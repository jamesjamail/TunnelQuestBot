const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");
const { block } = require("../executors");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("block")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("player name to block")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("Select a server")
        .addChoices([
          ["blue server", "BLUE"],
          ["green server", "GREEN"],
        ])
    )
    .setDescription(
      "Prevents a player from triggering notifications on all watches"
    ),
  async execute(interaction) {
    // NOTE: /blocks command responses differ is similar to /watches command
    await block(interaction)
      .then(async ({ content, embeds, metadata }) => {
        const btnRow = buttonBuilder([{ type: "globalUnblock" }]);
        await interaction.reply({
          content,
          embeds,
          components: [btnRow],
          ephemeral: true,
        });
        return await collectButtonInteractions(interaction, metadata);
      })
      .catch(async (err) => {
        return gracefulError(interaction, err);
      });
  },
};
