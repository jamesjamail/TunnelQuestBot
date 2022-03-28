const { SlashCommandBuilder } = require('@discordjs/builders');
const { list } = require('../executors');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('Lists available commands'),
	async execute(interaction) {
		await list(interaction)
			.then(async ({ embeds, metadata }) => {
				const btnRow = buttonBuilder([{ type: 'globalSnooze', active: metadata.globalSnooze }, { type: 'globalRefresh', active: metadata.globalRefreshActive }]);
				await collectButtonInteractions(interaction, metadata);
				interaction.reply({ embeds: embeds, components: [btnRow] });
			})
			.catch(console.error);

	},
};