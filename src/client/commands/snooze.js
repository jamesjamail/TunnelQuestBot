const { SlashCommandBuilder } = require("@discordjs/builders");
const { snooze } = require("../executors");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snooze")
    .setDescription("snooze watches")
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName("all")
        .setDescription("snooze all watches")
        .addSubcommand((subcommand) =>
          subcommand.setName("watches").setDescription("snooze all watches")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("watch")
        .setDescription("item you wish to snooze")
        .addStringOption((option) =>
          option.setName("item").setDescription("item name").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("server")
            .setDescription(
              "optionally specify a server - defaults to both servers"
            )
            .addChoices([
              ["blue server", "BLUE"],
              ["green server", "GREEN"],
            ])
        )
        .addNumberOption((option) =>
          option
            .setName("hours")
            .setDescription(
              "optionally specify hours to snooze for - defaults to 6 hours"
            )
        )
    ),
  async execute(interaction) {
    await snooze(interaction)
      .then(async ({ content, embeds, metadata }) => {
        // only show buttons if embeds
        if (embeds && embeds.length > 0) {
          const components = [
            buttonBuilder([
              { type: "itemSnooze", active: true },
              { type: "unwatch" },
              { type: "itemRefresh" },
            ]),
          ];
          await interaction.reply({
            content,
            embeds,
            components,
            ephemeral: true,
          });
          console.log("metadata = ", metadata);
          return await collectButtonInteractions(interaction, metadata);
        }
        return await interaction.reply({ content, ephemeral: true });
      })
      .catch(async (err) => {
        return await gracefulError(interaction, err);
      });
  },
};
