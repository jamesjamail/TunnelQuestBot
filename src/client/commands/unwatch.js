
const { SlashCommandBuilder } = require('@discordjs/builders');
const { unwatch } = require('../executors')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unwatch')
		.setDescription('End currently running watches')
		.addSubcommandGroup(subcommandGroup => 
			subcommandGroup
				.setName('subcommandgroup')
				.setDescription('subcommandgroup')
		)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('all')
                    .setDescription('End all watches.')
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('item')
                    .setDescription('end a specfific watch')
                    .addStringOption(option => option.setName('item').setDescription('watch to remove'))
            ),
	async execute(interaction) {
		const item = interaction.options.getString('item');
		const server = interaction.options.getString('server');
		console.log([item, server]);

		unwatch(interaction.user, [item, server])
		interaction.reply({content: 'Done!  Please check your Direct Messages.'})
	},
};