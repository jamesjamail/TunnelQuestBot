
const { SlashCommandBuilder } = require('@discordjs/builders');
const { unwatch } = require('../executors')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unwatch')
		.setDescription('End a currently running watch.')
		.addStringOption(option => option.setName('item').setDescription('Enter item name').setRequired(true))
		.addStringOption(option => option.setName('server').setDescription('Select a server').addChoices([['blue server', 'BLUE'],['green server', 'GREEN']]).setRequired(true)),
	async execute(interaction) {
		const item = interaction.options.getString('item');
		const server = interaction.options.getString('server');
		console.log([item, server]);

		unwatch(interaction.user, [item, server])
		interaction.reply({content: 'Done!  Please check your Direct Messages.'})
	},
};