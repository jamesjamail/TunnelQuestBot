
const { SlashCommandBuilder } = require('@discordjs/builders');
const { buttonBuilder, sendMessagesToUser } = require('../clientHelpers');
const { watches } = require('../executors')


module.exports = {
	data: new SlashCommandBuilder()
		.setName('watches')
		.addStringOption(option => option.setName('filter').setDescription('only show watches containing keyword(s)').setRequired(false))
		.setDescription('Shows your watches'),
	async execute(interaction) {
		await watches(interaction).then(async (embeds) => {
			const btnRow = buttonBuilder('watch')
			await sendMessagesToUser(interaction.client, interaction.user.id, embeds, btnRow)
			interaction.reply('Done! Please check your direct messages for results.');
		}).catch(console.error)
	},
};