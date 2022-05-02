const { SlashCommandBuilder } = require('@discordjs/builders');
const { watch } = require('../executors');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

// TODO: add subommands like unwatch.js, /watch item and /watch player
// /watch player could be useful for players who spotted auctions after the player logged
module.exports = {
	data: new SlashCommandBuilder()
		.setName('watch')
		.setDescription('Add or modify a watch.')
		.addStringOption(option => option.setName('item').setDescription('Enter item name').setRequired(true))
		.addStringOption(option => option.setName('server').setDescription('Select a server').addChoices([['blue server', 'BLUE'], ['green server', 'GREEN']]).setRequired(true))
		.addNumberOption(option => option.setName('price').setDescription('Enter optional maximum price')),
	async execute(interaction) {
		await watch(interaction)
			.then(async ({ embeds, metadata }) => {
				const btnRow = buttonBuilder([{ type: 'itemSnooze', active: metadata?.itemSnooze }, { type: 'unwatch' }, { type: 'itemRefresh' }]);
				await collectButtonInteractions(interaction, metadata);
				await interaction.reply({ embeds, components: [btnRow] });
			})
			.catch(async (err) => {
				await interaction.reply(err.message);
			});
	},
};