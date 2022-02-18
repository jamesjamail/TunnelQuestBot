
const { SlashCommandBuilder } = require('@discordjs/builders');
const { watch } = require('../executors')

//TODO: add subommands like unwatch.js, /watch item and /watch player
///watch player could be useful for players who spotted auctions after the player logged
module.exports = {
	data: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('Add or modify a watch.')
		.addStringOption(option => option.setName('item').setDescription('Enter item name').setRequired(true))
		.addStringOption(option => option.setName('server').setDescription('Select a server').addChoices([['blue server', 'BLUE'],['green server', 'GREEN']]).setRequired(true))
		.addNumberOption(option => option.setName('price').setDescription('Enter optional maximum price'))
		.addStringOption(option => option.setName('units').setDescription('Select a current format').addChoices([['kpp', 'TODO'],['pp', 'fix this']])),
	async execute(interaction) {
		const item = interaction.options.getString('item');
		const server = interaction.options.getString('server');
		const price = interaction.options.getNumber('price');
		console.log([item, server, price]);

		watch(interaction.user, [item, server, price])
		interaction.reply({content: 'Done!  Please check your Direct Messages.'})
	},
};