
const { SlashCommandBuilder } = require('@discordjs/builders');
const { helpMsg } = require('../../content/messages');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Lists available commands'),
	async execute(interaction) {
		interaction.reply({ content: helpMsg })
	}
};