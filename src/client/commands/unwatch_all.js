
const { SlashCommandBuilder } = require('@discordjs/builders');
const { unwatch } = require('../executors')

//TODO: Add a "Are you sure?" confirmation button to end all watches
//edit the message to add a button, then wait for the user to click it before executing the action
module.exports = {
	data: new SlashCommandBuilder()
		.setName('unwatch_all')
		.setDescription('Ends all watches.')
		.addStringOption(option => option.setName('item').setDescription('Enter item name').setRequired(true))
		.addStringOption(option => option.setName('server').setDescription('Select a server').addChoices([['blue server', 'BLUE'],['green server', 'GREEN']]).setRequired(true)),
	async execute(interaction) {
		const item = interaction.options.getString('item');
		const server = interaction.options.getString('server');
		console.log([item, server]);

		unwatch(interaction.user, ['ALL'])
		interaction.reply({content: 'Done!  Please check your Direct Messages.'})
	},
};