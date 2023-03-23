const { SlashCommandBuilder } = require("@discordjs/builders");
const { watch } = require("../executors");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watch")
    .setDescription("add or modify a watch.")
    .addStringOption((option) =>
      option
        .setName("watch_type")
        .setDescription("choose whether you want to watch WTS or WTB messages")
        .addChoices([
          ["watch for selling (WTS)", "WTS"],
          ["watch for buying (WTB)", "WTB"],
        ])
        .setRequired(true)
    )
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
        .addChoices([
          ["blue server", "BLUE"],
          ["green server", "GREEN"],
        ])
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
