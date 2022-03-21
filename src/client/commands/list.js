
const { SlashCommandBuilder } = require('@discordjs/builders');
const { list } = require('../executors')
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Lists available commands'),
	async execute(interaction) {
		await list(interaction)
			.then(async (res) => {
				const btnRow = buttonBuilder('list')
				await collectButtonInteractions(interaction)
				interaction.reply({embeds: res, components: [btnRow]})
			})
			.catch(console.error);
	
	},
};