const { SlashCommandBuilder } = require('@discordjs/builders');
const { list } = require('../executors');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('list active watches in a concise message'),
	async execute(interaction) {
		await list(interaction)
			.then(async ({ embeds, metadata }) => {
				if (!embeds || embeds.length < 1) {
					return await interaction.reply('You don\'t have any watches. Add some with `/watch`.');
				}
				console.log(interaction.isMessageComponent());
				const btnRow = buttonBuilder([{ type: 'globalSnooze', active: metadata.globalSnooze }, { type: 'globalRefresh' }]);
				await collectButtonInteractions(interaction, metadata);
				return await interaction.reply({ embeds, components: [btnRow] });
			})
			.catch(console.error);

	},
};