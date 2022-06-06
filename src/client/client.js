/* eslint-disable indent */
/* eslint-disable max-nested-callbacks */
const {
	Client,
	Intents,
	Collection,
} = require('discord.js');
const {
	Routes,
} = require('discord-api-types/v9');
const {
	REST,
} = require('@discordjs/rest');
const logger = require('winston');
const settings = require('../settings/settings.json');
const db = require('../db/db.js');
const fs = require('fs');
const path = require('path');
const commandDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js') && !file.includes('example'));
const { fetchAndFormatAuctionData } = require('../utility/wikiHandler');
const { collectButtonInteractions, watchNotificationBuilder, buttonBuilder } = require('./clientHelpers');
const { welcomeMsg } = require('../content/messages');
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
	colorize: true,
});
logger.level = 'debug';

// Initialize Discord Client
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGES] });
const TOKEN = settings.discord.token;
const GUILD = settings.discord.guild;
const COMMAND_CHANNEL = settings.discord.command_channel;
const GENERAL_CHANNEL = settings.discord.general_channel;
const BLUE_TRADING_CHANNEL = settings.servers.BLUE.trading_channel;
const GREEN_TRADING_CHANNEL = settings.servers.GREEN.trading_channel;

bot.on('ready', () => {
	logger.info(`Logged in as ${bot.user.tag}!`);
});

bot.commands = new Collection();
const commands = [];
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
	bot.commands.set(command.data.name, command);
}

// Don't get burned by testing development with global commands!
//
// Global commands are cached for one hour. New global commands will fan out
// slowly across all guilds and will only be guaranteed to be updated after an
// hour. Guild commands update instantly. As such, we recommend you use guild-based
// commands during development and publish them to global commands when they're
// ready for public use.

// TODO: dont forget to upgrade node to 14 and npm install, as well as adjust discord permissions for application commands

// When the client is ready, run this code (only once)

// TODO: can a pinned embedded message with a select for WTS/WTB, server preference, etc to allow for easier command syntax and results?
bot.once('ready', () => {
	console.log('Ready!');
	// Registering the commands in the client
	const CLIENT_ID = bot.user.id;
	const rest = new REST({
		version: '9',
	}).setToken(TOKEN);
	(async () => {
		try {
			await rest.put(
				Routes.applicationGuildCommands(CLIENT_ID, GUILD), {
					body: commands,
				},
			);
			console.log('Successfully registered guild application commands');
		}
 catch (error) {
			if (error) console.error(JSON.stringify(error.rawError.errors));
		}
	})();
});


// command syntax as well as executors are defined in /commands directory
bot.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = bot.commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	}
 catch (error) {
		console.error('catch block error', error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});


bot.on('messageCreate', async message => {
	//	filter out auction spam from general chat
	if (!message.author.bot && message.channelId === GENERAL_CHANNEL) {
		const content = message.content.toUpperCase();
		if (content.includes('WTS') || content.includes('WTB') || content.includes('WTT')) {
			await bot.users.cache.get(message.author.id).send(`Hi <@${message.author.id}>, I'm trying to keep #general_chat free of auction listings.  Please use either <#${GREEN_TRADING_CHANNEL}> or <#${BLUE_TRADING_CHANNEL}>. Thanks!`).catch(console.error);
			await message.delete().catch(console.error);
		}
	}
	// inform user about slash commands if DM or public command space message
	else if (!message.author.bot && message.channelId === COMMAND_CHANNEL || message.channel.type === 'dm') {
		await message.reply('I respond to slash commmands.  Type `/` to get started.').catch(console.error);
	}
});


// server greeting for users who join
bot.on('guildMemberAdd', async (member) => {
	const memberTag = member.user.tag; // GuildMembers don't have a tag property, read property user of guildmember to get the user object from it
	await bot.users.cache.get(member.user.id).send(`**Hi ${memberTag}!**\n\n` + welcomeMsg).catch(console.error);
});


async function pingUser(watchId, user, userId, seller, item, price, server, fullAuction, timestamp) {
	// query db for communication history and blocked sellers - abort if not valid
	const validity = await db.validateWatchNotification(userId, watchId, seller);
	if (!validity) return;
	await db.postSuccessfulCommunication(watchId, seller);

	// TODO: watch notifications have different fields from watch results
	const embed = await watchNotificationBuilder({
		item,
		server,
		price,
		seller: seller || null,
		fullAuction,
		timestamp,
	});

	const directMessageChannel = await bot.users.createDM(user);
	const btnRow = buttonBuilder([{ type: 'itemSnooze' }, { type: 'unwatch' }, { type: 'watchBlock' }, { type: 'itemRefresh' }]);
	console.log(embed);
	directMessageChannel.send({ embeds: embed, components: [btnRow] })
	.then(async (message) => {
		console.log(message);
		await collectButtonInteractions(null, { id: watchId, seller }, message);
	})
	.catch(console.error);
}

async function streamAuction(auction_user, auction_contents, server) {
	const channelId = settings.servers[server].stream_channel;
	const classicChannelId = settings.servers[server].stream_channel_classic;
	const rawAuction = `\`\`\`\n${auction_user} auctions, \'${auction_contents}\'\`\`\``;

	await fetchAndFormatAuctionData(auction_user, auction_contents, server).then(async formattedAuctionMessage => {
		const streamChannel = await bot.channels.fetch(channelId);
		streamChannel.send({ embeds: [formattedAuctionMessage] });
		await bot.channels.fetch(channelId.toString());
	}).catch(console.error);

	await bot.channels.fetch(classicChannelId.toString())
		.then(async (channel) => {
			await channel.send(rawAuction);
		})
		.catch(console.error);
}


bot.login(TOKEN);


module.exports = { pingUser, streamAuction };
