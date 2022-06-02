const { SlashCommandBuilder } = require('@discordjs/builders');
const { buttonBuilder, sendMessagesToUser, gracefulError } = require('../clientHelpers');
const { blocks } = require('../executors');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('blocks')
		.addStringOption(option => option.setName('filter').setDescription('only show watches containing keyword(s)').setRequired(false))
		.setDescription('returns each block as a direct message'),
	async execute(interaction) {
		// NOTE: /blocks command responses is similar to /watches command
		await blocks(interaction).then(async ({ embeds, metadata }) => {
			// handle no results
			if (!embeds || embeds.length < 1) {
				const args = interaction.options.data;
				const noResultsMsg = args.length < 1 ?
					'You don\'t have any blocks.  Add some with \`/block\`.'
					:
					'You don\'t have any blocks for `' + args[0].value + '`.';
				return await interaction.reply(noResultsMsg);
			}

			// NOTE: metadata from blocks() is an array of metadataItems
			const btnRows = metadata.map(() => {
				// refresh should be inactive on blocks response, otherwise it's confusing
				return buttonBuilder([{ type: 'globalUnblock', active: false }]);
			});

			// button interactions are collected from within function below
			return await sendMessagesToUser(interaction, interaction.user.id, embeds, btnRows, metadata)
				.then(async (res) => {
					return await interaction.reply('Done! Please check your direct messages for results.');
				});
		}).catch(async (err) => {
			return gracefulError(interaction, err);
		});
	},
};