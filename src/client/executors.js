const { helpMsg } = require('../content/messages');
const db = require('../db/db.js');
const { fetchAndFormatAuctionData, fetchImageUrl, fetchWikiPricing, SERVER_COLOR } = require('../utility/wikiHandler');
const { formatCapitalCase, removeLogTimestamp } = require('../utility/utils.js');
const Discord = require('discord.js');
const moment = require('moment');
const wiki_url = require('../utility/data/items.json');
const { embedReactions, MessageType, watchBuilder } = require('./clientHelpers');
const { DataNode } = require('domhandler');

function help(message) {
	message.author.send('Thanks for using TunnelQuestBot! ' + helpMsg);
}

async function watch(interaction) {
	const args = interaction.options.data;
	if (args.length > 2 && args[2].value > 0) {
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value, args[2].value)
			.then(async (res) => {
				console.log('res = ', res)
				//success response should respond with watch embedded
				// interaction.reply(`Got it! Now watching auctions for \`${args[0]}\` at \`${args[2]}pp\` or less on Project 1999 \`${args[1]}\` Server.`);
				// const msg = new Discord.MessageEmbed()
				// 	.setColor(SERVER_COLOR[args[1].value])
				// 	.setTitle(args[0].value)
				// 	.setURL('https://discord.js.org/')
				// 	.setAuthor({ name: 'Some name', iconURL: 'https://i.imgur.com/AfFp7pu.png', url: 'https://discord.js.org' })
				// 	.setDescription(`at ${args[2].value}pp or less`)
				// 	.setThumbnail('https://i.imgur.com/AfFp7pu.png')
				// 	.addFields(
				// 		{ name: 'Regular field title', value: 'Some value here' },
				// 		{ name: '\u200B', value: '\u200B' },
				// 		{ name: 'Inline field title', value: 'Some value here', inline: true },
				// 		{ name: 'Inline field title', value: 'Some value here', inline: true },
				// 	)
				// 	.addField('Inline field title', 'Some value here', true)
				// 	.setImage('https://i.imgur.com/AfFp7pu.png')
				// 	.setTimestamp()
				// 	.setFooter({ text: 'Some footer text here', iconURL: 'https://i.imgur.com/AfFp7pu.png' });
					const msg = await watchBuilder({item: args[0].value, server: args[1].value, price: args[2].value, datetime: Date.now()})	
				return Promise.resolve(msg)
			})
			.catch((err) => {
				console.error(err)
				//TODO: log error
				return Promise.reject(err)
			})
	}
	else {
		// if no price, set watch accordingly
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value, -1)
			.then((res) => {
				return Promise.resolve(`Got it! Now watching auctions for \`${args[0]}\` at any price on Project 1999 \`${args[1]}\` Server.`);
			})
			.catch((err) => {
				return Promise.reject(err)
			})
	}
}

function unwatch(user, args) {
	if (args && args[0] === 'ALL') {
		db.endAllWatches(user.id);
		user.send('Succesfully ended all your watches.');
	}
	else if (args === undefined || args[0] === undefined || args[1] === undefined) {
		user.send('Please specify both \`item\` and \`server\` to end a watch.');
		// validate server
	}
	else if (args[0] === 'ALL') {
		db.endAllWatches(user.id);
		user.send('Succesfully ended all your watches.');
	}
	else if (args[1] !== 'GREEN' && args[1] !== 'BLUE') {
		user.send(`Sorry, I don't recognize the server name ${args[1]}.  Please try \`green\` or \`blue\`.`);
	}
	else {
		// end the watch
		db.endWatch(user.id, args[0], args[1]);
		user.send(`Got it! No longer watching auctions for \`${args[0]}\` on Project 1999 \`${args[1]} server\`.`);
	}
}

async function watches(interaction) {
	const args = interaction.options.data;
	console.log(args)

	// TODO: if less than 10 embeds, use interaction.reply - otherwise send all as separate messages
	db.showWatch(interaction.user.id, args && args.length > 0 ? args[0].value : '', async (res) => {
		if (res.success) {
			const urls = await Promise.all(res.data.map(async (item) => {
				return await fetchImageUrl(item.name.toUpperCase())
			}));
			
			// const urls = res.data.map((item) => {
			// 	return await fetchImageUrl(item.name.toUpperCase())
			// })
			console.log('urls = ', urls)

			const embeds = res.data.map((watch, index) => {
				const watches = [];
				const expiration = moment(watch.datetime).add(7, 'days');
				const now = moment(new Date);
				const diff = expiration.diff(now);
				const diffDuration = moment.duration(diff);
				const snoozeExpiration = moment(watch.expiration).add(0, 'seconds');
				const snoozeDiff = snoozeExpiration.diff(now);
				const snoozeDuration = moment.duration(snoozeDiff);
				const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp');
				const item = formatCapitalCase(watch.name);
				const server = `${formatCapitalCase(watch.server)} Server`;
				const url = urls[index] || null
				watches.push({
					name: `${formatCapitalCase(watch.name)} | ${price} | ${formatCapitalCase(watch.server)}`,
					value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
					inline: false,
				});

				if (watch.snoozed) {
					watches.push({
						name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
						value: `Snoozed for another ${snoozeDuration.hours()} hours and ${snoozeDuration.minutes()} minutes`,
						inline: false,
					});
				}

				const matchingItemName = !!wiki_url[watch.name.toUpperCase()];
				const href = matchingItemName ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null
				console.log('href = ', href)
				return new Discord.MessageEmbed()
					.setColor(SERVER_COLOR[watch.server])
					.setAuthor({ name: `${formatCapitalCase(watch.name)}`, url: href, iconURL: url })
					.addFields(watches)
					.setTitle(watch.name)
					.setFooter({ text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻' })
					// .setThumbnail(wiki_url[watch.name.toUpperCase()] ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null)
					// .setImage(href)
					// .setThumbnail(url)


			});
			if (embeds.length <= 10) {
				// return interaction.user.send({embeds: embeds})
				return interaction.reply({ embeds: embeds });
			}
			else {
				return embeds.forEach((embed) => {
					interaction.reply({ embeds: [embed] });
				});

			}
		}

		else if (args && args[0]) {
			interaction.reply(`You don\'t have any watches for \`\`${args[0].value}\`\`.`);
		}
		else {
			interaction.reply('You don\'t have any watches.');
		}
	});
}

async function list(interaction, args) {
	return db.showWatches(interaction.member.id, (res) => {
		if (res.success) {
			const globalSnooze = res.msg[0].global_snooze;
			const watches = [];
			res.msg.forEach(watch => {
				const expiration = moment(watch.datetime).add(7, 'days');
				const now = moment(new Date);
				const diff = expiration.diff(now);
				const diffDuration = moment.duration(diff);
				const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp');
				watches.push({
					name: `\`${watch.watch_snooze ? '💤 ' : ''}${formatCapitalCase(watch.name)}\` | ${watch.price === -1 ? '' : ` \`${price}\` | `}\`${formatCapitalCase(watch.server)}\``,
					value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
					inline: false,
				});
			});
			const embed = new Discord.MessageEmbed()
				.setColor('#EFE357')
				.setTitle(globalSnooze ? '__Active Watches (Snoozed)__' : '__Active Watches__')
				.addFields(watches);
			console.log(embed);
			interaction.reply({ embeds: [embed] });

		}
		else {
			interaction.reply('You don\'t have any watches.  Add some with /watch');
		}
	});
}

function extend(message, args) {
	db.extendAllWatches(message.author.id);
	message.author.send('All watches succesfully extended for another 7 days.');
}

function block(message, args) {
	if (args && args[1] && args[1] === 'BLUE' || args[1] === 'GREEN') {
		db.blockSeller(message.author.id, args[0], args[1], null);
		message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${args[0]} on ${args[1]}.`);
	}
	else {
		db.blockSeller(message.author.id, args[0], null, null);
		message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${args[0]} on both servers.  To only block this seller on one server, use \`\`!block ${args[0]}, server\`\``);
	}
}

function unblock(message, args) {
	if (args && args[1] && args[1] === 'BLUE' || args[1] === 'GREEN') {
		db.unblockSeller(message.author.id, args[0], args[1], null);
		message.author.send(`People change.  No longer blocking ${formatCapitalCase(args[0])} on ${formatCapitalCase(args[1])} server.`);
	}
	else {
		db.unblockSeller(message.author.id, args[0], null, null);
		message.author.send(`People change.  No longer blocking ${formatCapitalCase(args[0])} on either server.`);
	}
}

function blocks(message, args) {
	db.showBlocks(message.author.id, (res) => {
		const blocks = [];
		if (res.user_blocks.length === 0 && res.watch_blocks.length === 0) {
			message.author.send('You haven\'t blocked any sellers.  Use `!block seller, server` to block a seller on all watches, or react with the `🔕` emoji on a watch notification to block a seller only for a certain item.');
		}
		else {
			if (res.user_blocks.length > 0) {
				res.user_blocks.forEach(block => {
					blocks.push({
						name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
						value: 'All Watches',
						inline: false,
					});
				});

			} if (res.watch_blocks.length > 0) {
				res.watch_blocks.forEach(block => {
					blocks.push({
						name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
						value: `\`${formatCapitalCase(block.name)}\` Watch`,
						inline: false,
					});
				});
			}
			message.author.send(
				new Discord.MessageEmbed()
					.setColor('#EFE357')
					.setTitle('__Blocks__')
					.addFields(blocks),
			)
				.catch(console.error);
		}
	});
}

function snooze(message, args) {
	// snooze all watches
	if (args && args[0]) {
		db.snooze('USER', message.author.id, args[0]);
		message.author.send(`Sleep is good.  Pausing notifications on all watches for ${args[0]} hours.  Use \`\`!unsnooze\`\` to resume watch notifications.`);
	}
	else {
		db.snooze('USER', message.author.id);
		message.author.send('Sleep is good.  Pausing notifications on all watches for 6 hours.  Use ``!unsnooze`` to resume watch notifications.');
	}
}

function unsnooze(message, args) {
	db.unsnooze('USER', message.author.id);
	message.author.send('Rise and grind.  Let\'s get that Loaf of Bread.');
}

function gnomeFact(message, args) {
	// TODO: return a random gnome fact
}

function unrecognized(message, args) {
	message.author.send('Sorry, I didn\'t recognized that command.  Please check your syntax and try again. Try ``!help`` for more info.');
}

module.exports = {
	help,
	watch,
	unwatch,
	watches,
	list,
	extend,
	block,
	unblock,
	blocks,
	snooze,
	unsnooze,
	gnomeFact,
	unrecognized,
};