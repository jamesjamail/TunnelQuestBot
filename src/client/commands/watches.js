const { SlashCommandBuilder } = require('@discordjs/builders');
const { buttonBuilder, sendMessagesToUser } = require('../clientHelpers');
const { watches } = require('../executors');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('watches')
		.addStringOption(option => option.setName('filter').setDescription('only show watches containing keyword(s)').setRequired(false))
		.setDescription('Shows your watches'),
	async execute(interaction) {
		// NOTE: /watches command responses differ from all other commands!
		// Historically, !watches has returned an individual response for each watch.
		// While it's possible to reply to a command with up to 10 embeds, only one
		// set of buttons can be applied to the entire interaction response, removing
		// much of the functionality offered by individual message responses
		await watches(interaction).then(async ({ embeds, metadata }) => {
			console.log('watches metadata ', metadata);
			// NOTE: metadata from watches() is an array of metadataItems

			const btnRows = metadata.map((individualMetadata) => {
				// refresh should be inactive on watches response, otherwise it's confusing
				return buttonBuilder([{ type: 'itemSnooze', active: individualMetadata.snoozed }, { type: 'unwatch' }, { type: 'itemRefresh' }]);
			});

			// button interactions are collected from within function below
			return await sendMessagesToUser(interaction, interaction.user.id, embeds, btnRows, metadata)
				.then(async (res) => {
					return await interaction.reply('Done! Please check your direct messages for results.');
				})
				// TODO: handle error in response
				.catch(console.error);

		}).catch(console.error);
	},
};