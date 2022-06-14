const { SlashCommandBuilder } = require("@discordjs/builders");
const { helpMsg } = require("../../content/messages");
const { gracefulError } = require("../clientHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lists available commands"),
  async execute(interaction) {
    return await interaction
      .reply({ content: helpMsg, ephemeral: true })
      .catch(async (err) => {
        return await gracefulError(interaction, err);
      });
  },
};
