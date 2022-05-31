const { SlashCommandBuilder } = require('@discordjs/builders');
const { buttonBuilder, collectButtonInteractions } = require('../clientHelpers');
const { unblock } = require('../executors');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('unblock')
		.addStringOption(option => option.setName('player').setDescription('player to unblockblock').setRequired(true))
		.addStringOption(option => option.setName('server').setDescription('select a server').addChoices([['blue server', 'BLUE'], ['green server', 'GREEN']]))
		.setDescription('Removes a block on a player'),
	async execute(interaction) {
		await unblock(interaction).then(async ({ content, embeds, metadata }) => {
			await interaction.reply({ content });

		}).catch(async (err) => {
			await interaction.reply(err.message);
		});
	},
};