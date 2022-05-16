const { SlashCommandBuilder } = require('@discordjs/builders');
const { snooze } = require('../executors');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('snooze')
		.setDescription('snooze watches')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('all')
				.setDescription('snooze all watches')
				.addSubcommand(subcommand =>
					subcommand
						.setName('watches')
						.setDescription('snooze all watches'),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('watch')
				.setDescription('item you wish to snooze')
				.addStringOption(option => option.setName('item').setDescription('item name').setRequired(true))
				.addStringOption(option => option.setName('server').setDescription('optionally specify a server - defaults to both servers').addChoices([['blue server', 'BLUE'], ['green server', 'GREEN']])),
		),
	// TODO: accept hours as an optional argument


	async execute(interaction) {
		await snooze(interaction)
			.then(async ({ content, embeds, metadata }) => {
				// console.log('embeds = ', embeds);
				// console.log('metadata = ', metadata);

				// only show buttons if embeds
				if (embeds && embeds.length > 0) {
					const components =
                        [buttonBuilder([{ type: 'itemSnooze', active: true }, { type: 'unwatch' }, { type: 'itemRefresh' }])];
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