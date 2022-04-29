const { SlashCommandBuilder } = require('@discordjs/builders');
const { buttonBuilder, sendMessagesToUser } = require('../clientHelpers');
const { blocks } = require('../executors');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('blocks')
		.addStringOption(option => option.setName('filter').setDescription('only show watches containing keyword(s)').setRequired(false))
		.setDescription('returns each block as a direct message'),
	async execute(interaction) {
		// NOTE: /blocks command responses differ is similar to /watches command
		await blocks(interaction).then(async ({ embeds, metadata }) => {
			// handle no results
			if (!embeds || embeds.length < 1) {
				const args = interaction.options.data;
				console.log('args = ', args);
				const noResultsMsg = args.length < 1 ?
					'You don\'t have any blocks.  Add some with \`/watch\`.'
					:
					'You don\'t have any blocks for `' + args[0].value + '`.';
				return await interaction.reply(noResultsMsg);
			}
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