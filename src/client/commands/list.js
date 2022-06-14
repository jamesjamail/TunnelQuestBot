const { SlashCommandBuilder } = require("@discordjs/builders");
const { list } = require("../executors");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("list active watches in a concise message"),
  async execute(interaction) {
    await list(interaction)
      .then(async ({ embeds, metadata }) => {
        if (!embeds || embeds.length < 1) {
          return await interaction.reply({
            content: "You don't have any watches. Add some with `/watch`.",
            ephemeral: true,
          });
        }
        const btnRow = buttonBuilder([
          { type: "globalSnooze", active: metadata.globalSnooze },
          { type: "globalRefresh" },
        ]);
        await interaction.reply({
          embeds,
          components: [btnRow],
          ephemeral: true,
        });
        return await collectButtonInteractions(interaction, metadata);
      })
      .catch((err) => {
        gracefulError(interaction, err);
      });
  },
};
