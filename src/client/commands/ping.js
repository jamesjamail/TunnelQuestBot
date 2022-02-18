
const { SlashCommandBuilder } = require('@discordjs/builders');
const {
	MessageEmbed
} = require('discord.js');

const embed = new MessageEmbed()
			.setColor('#EFE357')
			.setTitle('embed test')
			

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with pong'),
	async execute(interaction) {
		
		interaction.reply({ embeds: [embed, embed, embed, embed] })
	}
};