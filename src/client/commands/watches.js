
const { SlashCommandBuilder } = require('@discordjs/builders');
const { watches } = require('../executors')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('watches')
		.setDescription('Shows your watches'),
	async execute(interaction) {
		//ideally I'd like to handle all responses in these files, but oddly could
		//not get async/await to work properly in this code block, so the interaction
		//is passed to executors
		await watches(interaction);
	
	},
};