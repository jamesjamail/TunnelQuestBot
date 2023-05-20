const { SlashCommandBuilder } = require("@discordjs/builders");
const { watch } = require("../executors");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");

// TODO: add subommands like unwatch.js, /watch item and /watch player
// /watch player could be useful for players who spotted auctions after the player logged
module.exports = {
  data: new SlashCommandBuilder()
    .setName("watch")
    .setDescription("add or modify a watch.")
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("the name of the item you want to watch")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("select a server")
        .addChoices(
          {name: "blue server", value: "BLUE"},
          {name: "green server", value: "GREEN"},
        )
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option.setName("price").setDescription("enter optional maximum price")
    ),
  async execute(interaction) {
    await watch(interaction)
      .then(async ({ embeds, metadata }) => {
        const btnRow = buttonBuilder([
          { type: "itemSnooze", active: metadata?.itemSnooze },
          { type: "unwatch" },
          { type: "itemRefresh" },
        ]);
        await interaction.reply({
          embeds,
          components: [btnRow],
          ephemeral: true,
        });
        return await collectButtonInteractions(interaction, metadata);
      })
      .catch(async (err) => {
        return await gracefulError(interaction, err);
      });
  },
};
