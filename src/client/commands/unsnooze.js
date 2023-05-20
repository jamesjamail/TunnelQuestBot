const { SlashCommandBuilder } = require("@discordjs/builders");
const { unsnooze } = require("../executors");
const {
  buttonBuilder,
  collectButtonInteractions,
  gracefulError,
} = require("../clientHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unsnooze")
    .setDescription("unsnoozes watches")
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName("all")
        .setDescription("unsnooze all watches")
        .addSubcommand((subcommand) =>
          subcommand.setName("watches").setDescription("unsnooze all watches")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("watch")
        .setDescription("unsnooze a specific watch")
        .addStringOption((option) =>
          option.setName("item").setDescription("item name").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("server")
            .setDescription(
              "optionally specify a server - defaults to both servers"
            )
            .addChoices(
              {name: "blue server", value: "BLUE"},
              {name: "green server", value: "GREEN"},
            )
        )
    ),
  async execute(interaction) {
    await unsnooze(interaction)
      .then(async ({ content, embeds, metadata }) => {
        if (embeds && embeds.length > 0) {
          const components = [
            buttonBuilder([
              { type: "itemSnooze", active: false },
              { type: "unwatch", active: false },
              { type: "itemRefresh" },
            ]),
          ];
          await interaction.reply({
            content,
            embeds,
            components,
            ephemeral: true,
          });
          return await collectButtonInteractions(interaction, metadata);
        }
        return await interaction.reply({ content, ephemeral: true });
      })
      .catch(async (err) => {
        return await gracefulError(interaction, err);
      });
  },
};
