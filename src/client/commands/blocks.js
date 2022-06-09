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
			const btnRows = metadata.map((singleMetadata) => {
				// watch_id in metadata means its a watch block, not a global block
				if (singleMetadata.watch_id) {
					return buttonBuilder([{ type: 'watchUnblock', active: false }]);
				} else {
					return buttonBuilder([{ type: 'globalUnblock', active: false }]);
				}
			});

			
			// interaction can only be responded to within 3 seconds.  reply immediately and update once complete
			await interaction.reply('Working on it...')
			// button interactions are collected from within function below
			return await sendMessagesToUser(interaction, interaction.user.id, embeds, btnRows, metadata)
				.then(async (res) => {
					return await interaction.editReply('Done! Please check your direct messages for results.');
				});
		}).catch(async (err) => {
			return await gracefulError(interaction, err);
		});
	},
};