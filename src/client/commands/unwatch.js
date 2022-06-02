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
		// TODO: this switch should be moved to executors
		switch (command) {
		case 'watches':
			// unwatch all
			return await unwatchAll(interaction)
				.then(async () => {
					return await interaction.reply('All your watches have been removed.');
				})
				.catch(async (err) => {
					return await gracefulError(interaction, err);
				});
		case 'item':
			// unwatch item
			return await unwatch(interaction)
				.then(() => {
					return interaction.reply('Your `' + item + '` watch has been removed.');
				})
				.catch(async (err) => {
					return await gracefulError(interaction, err);
				});
		default:
			return;
		}
	},
};