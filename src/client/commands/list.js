
const { SlashCommandBuilder } = require('@discordjs/builders');
const { list } = require('../executors')
const {
	MessageEmbed
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Lists available commands'),
	async execute(interaction) {
        list(interaction.user)
        interaction.reply({content: 'Done!  Please check your Direct Messages.'})
	},
};