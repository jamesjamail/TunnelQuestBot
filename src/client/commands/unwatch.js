const { SlashCommandBuilder } = require('@discordjs/builders');
const { unwatch, unwatchAll } = require('../executors');
const { gracefulError } = require('../clientHelpers');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unwatch')
		.setDescription('End currently running watches')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('all')
				.setDescription('end all watches')
				.addSubcommand(subcommand =>
					subcommand
						.setName('watches')
						.setDescription('end all watches'),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('item')
				.setDescription('end a specfific watch')
				.addStringOption(option => option.setName('item').setDescription('watch to remove').setRequired(true))
				.addStringOption(option => option.setName('server').setDescription('Select a server').addChoices([['blue server', 'BLUE'], ['green server', 'GREEN']])),
		),

	async execute(interaction) {
		const command = interaction.options.getSubcommand();
		const item = interaction.options.getString('item');
		const server = interaction.options.getString('server');
		// TODO: this switch should be moved to executors
		switch (command) {
		case 'watches':
			// unwatch all
			return await unwatchAll(interaction)
				.then(async () => {
					return await interaction.reply({content: 'All your watches have been removed.', ephemeral: true });
				})
				.catch(async (err) => {
					return await gracefulError(interaction, err);
				});
		case 'item':
			// unwatch item
			return await unwatch(interaction)
				.then((res) => {
					// handle to results
					if (res.rowCount === 0) {
						//message depends on if server argument specified
						const args = interaction.options.data[0].options;
						if (args.length > 1) {
							return interaction.reply({content: `You don't have a watch for \`${item.toUpperCase()}\` on \`${server}\` server.`, ephemeral: true });
						}
						return interaction.reply({content: `You don't have a watch for \`${item.toUpperCase()}\`.`, ephemeral: true });
					}
					return interaction.reply({content: 'Your `' + item.toUpperCase() + '` watch has been removed.', ephemeral: true });
				})
				.catch(async (err) => {
					return await gracefulError(interaction, err);
				});
		default:
			return;
		}
	},
};