const { SlashCommandBuilder } = require('@discordjs/builders');
const {
	MessageEmbed, MessageActionRow, MessageButton,
} = require('discord.js');

const embed1 = new MessageEmbed()
	.setColor('#EFE357')
	.setTitle('embed test')
	.setAuthor({ name: 'bobby mcpooppants', iconURL:'https://wiki.project1999.com/images/Item_654.png', url: 'https://wiki.project1999.com/images/Item_654.png' })
	.setImage('https://wiki.project1999.com/images/Item_1043.png');

const btn1 = new MessageButton()
			.setCustomId('success')
			.setLabel('refresh')
			.setStyle('SUCCESS')

const btn2 = new MessageButton()
			.setCustomId('blah')
			.setLabel('end')
			.setStyle('PRIMARY')


const btn3 = new MessageButton()
			.setCustomId('danger')
			.setLabel('end')
			.setStyle('DANGER')


const row = new MessageActionRow()

const buttons = [btn1, btn2, btn3]

row.addComponents(buttons)
// buttons.forEach((btn) => {
// 	row.addComponents(btn);
// })



const embed2 = new MessageEmbed()
	.setColor('#EFE357')
	.setTitle('embed test')
	.setImage('https://wiki.project1999.com/images/Item_1043.png');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with pong'),
	async execute(interaction) {

		await interaction.reply({ embeds: [embed1], components: [row] });
	},
};