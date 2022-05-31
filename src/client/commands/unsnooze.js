const { SlashCommandBuilder } = require('@discordjs/builders');
const { unsnooze } = require('../executors');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unsnooze')
		.setDescription('unsnoozes watches')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('all')
				.setDescription('unsnooze all watches')
				.addSubcommand(subcommand =>
					subcommand
						.setName('watches')
						.setDescription('unsnooze all watches'),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('watch')
				.setDescription('item you wish to unsnooze')
				.addStringOption(option => option.setName('item').setDescription('item name').setRequired(true))
				.addStringOption(option => option.setName('server').setDescription('optionally specify a server - defaults to both servers').addChoices([['blue server', 'BLUE'], ['green server', 'GREEN']])),
		),
	// TODO: accept hours as an optional argument

	async execute(interaction) {
		await unsnooze(interaction)
			.then(async ({ content, embeds, metadata }) => {
				console.log('content, embeds, metadata', content, embeds, metadata);
				if (embeds && embeds.length > 0) {
					const components =
                        [buttonBuilder([{ type: 'itemSnooze', active: false }, { type: 'unwatch', active: false }, { type: 'itemRefresh' }])];
					await collectButtonInteractions(interaction, metadata);
					return await interaction.reply({ content, embeds, components });
				}
				return await interaction.reply({ content });

			})
			.catch(async (err) => {
				return await interaction.reply(err.message);
			})
		;
	},
};