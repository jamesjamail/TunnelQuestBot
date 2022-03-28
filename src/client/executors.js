const { helpMsg } = require('../content/messages');
const db = require('../db/db.js');
const { fetchAndFormatAuctionData, fetchImageUrl, fetchWikiPricing, SERVER_COLOR } = require('../utility/wikiHandler');
const { formatCapitalCase, removeLogTimestamp } = require('../utility/utils.js');
const Discord = require('discord.js');
const moment = require('moment');
const wiki_url = require('../utility/data/items.json');
const sendMessagesToUser = require('./client');
const { embedReactions, MessageType, watchBuilder, buildListResponse } = require('./clientHelpers');
function help(message) {
	message.author.send('Thanks for using TunnelQuestBot! ' + helpMsg);
}

async function watch(interaction) {
	const args = interaction.options.data;
	if (args.length > 2 && args[2].value > 0) {
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value, args[2].value)
			.then(async (res) => {
				const msg = await watchBuilder({ item: args[0].value, server: args[1].value, price: args[2].value, datetime: Date.now() });
				return Promise.resolve(msg);
			})
			.catch((err) => {
				console.error(err);
				// TODO: log error
				return Promise.reject(err);
			});
	}
	else {
		// if no price, set watch accordingly
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value, -1)
			.then(async (res) => {
				const msg = await watchBuilder({ item: args[0].value, server: args[1].value, price: null, datetime: Date.now() }).catch(console.error);
				return Promise.resolve(msg);

			})
			.catch((err) => {
				console.error(err);
				return Promise.reject(err);
			});
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

	return await db.showWatch(interaction.user.id, args && args.length > 0 ? args[0].value : '')
		.then(async (res) => {
			if (res.length > 0) {
				const urls = await Promise.all(res.map(async (item) => {
					return await fetchImageUrl(item.name);
				}));

				const embeds = res.map((watch, index) => {
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
					// const url = await fetchImageUrl(item).catch(console.error);
					// console.log('watches url = ', url, item)

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
					const href = matchingItemName ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null;
					return new Discord.MessageEmbed()
						.setColor(SERVER_COLOR[watch.server])
						.setAuthor({ name: `${formatCapitalCase(watch.name)}`, url: href, iconURL: urls[index] })
						.addFields(watches)
						.setTitle(watch.name)
						.setFooter({ text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻' });
					// .setThumbnail(wiki_url[watch.name.toUpperCase()] ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null)
					// .setImage(href)
					// .setThumbnail(url)


				});
				return Promise.resolve({ embeds, metadata: res });
			}

			else if (args && args[0]) {
				return Promise.resolve(`You don\'t have any watches for \`\`${args[0].value}\`\`.`);
			}
			else {
				return Promise.resolve('You don\'t have any watches.');
			}
		});
}

async function list(interaction) {
	return await db.listWatches(interaction.user.id)
		.then((res) => {
			const embeds = buildListResponse(res);
			// let's consider refresh button "activated" if pressed within last minute
			const created = moment(res[0].datetime).add(0, 'second');
			const oneMinAgo = moment().subtract('1', 'minute');
			const globalRefreshActive = created.isAfter(oneMinAgo);
			return Promise.resolve({
				// only pass thru relevant data
				embeds, metadata: { watch_id: res[0].id, globalSnooze: res[0].global_snooze, globalRefreshActive },
			});
		})
		.catch((err) => {
			return Promise.reject(err);
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