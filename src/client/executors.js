const { helpMsg } = require('../content/messages');
const db = require('../db/db.js');
const { fetchAndFormatAuctionData, fetchImageUrl, fetchWikiPricing, SERVER_COLOR } = require('../utility/wikiHandler');
const { formatCapitalCase, removeLogTimestamp } = require('../utility/utils.js');
const Discord = require('discord.js');
const moment = require('moment');
const wiki_url = require('../utility/data/items.json');
const sendMessagesToUser = require('./client');
const { embedReactions, MessageType, watchBuilder, buildListResponse, buttonBuilder, blockBuilder, dedupeBlockResults } = require('./clientHelpers');
function help(message) {
	message.author.send('Thanks for using TunnelQuestBot! ' + helpMsg);
}

async function watch(interaction) {
	const args = interaction.options.data;
	if (args.length > 2 && args[2].value > 0) {
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value, args[2].value)
			.then(async (res) => {
				const metadata = {
					id: res.id, itemSnooze: res.snoozed, globalRefreshActive: false,
				};
				const embeds = await watchBuilder([{ name: args[0].value, server: args[1].value, price:args[2].value, datetime: Date.now() }]).catch(console.error);
				return Promise.resolve({ embeds, metadata });
			})
			.catch((err) => {
				console.error(err);
				// TODO: log error
				return Promise.reject(err);
			});
	}
	else {
		// if no price, set watch accordingly
		return await db.addWatch(interaction.user.id, args[0].value, args[1].value)
			.then(async (res) => {
				console.log('no price res = ', res);
				const metadata = {
					id: res.id, itemSnooze: res.snoozed, globalRefreshActive: false,
				};
				const embeds = await watchBuilder([{ name: args[0].value, server: args[1].value, price: -1, datetime: Date.now() }]).catch(console.error);
				return Promise.resolve({ embeds, metadata });

			})
			.catch((err) => {
				console.error(err);
				return Promise.reject(err);
			});
	}
}

async function unwatch(interaction) {
	// does anything use this other than unwatch? careful because arguments are in a subcommand group
	const args = interaction.options.data[0].options;
	console.log(args);
	// TODO: if 0 rows affected, inform user "You don't have any watches for..."
	if (args.length > 1) {
		return await db.endWatch(interaction.user.id, args[0].value, args[1].value);
	}
	// end the watch
	return await db.endWatch(interaction.user.id, args[0].value);
}

async function unwatchAll(interaction) {
	return await db.endAllWatches(interaction.user.id)
		.catch((err) => {
			return Promise.reject(err);
		});
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
				console.log('res = ', res);
				return Promise.resolve({ embeds, metadata: res });
			}
			else {
				return Promise.resolve({ embeds: [] });
			}
		});
}

async function list(interaction) {
	return await db.listWatches(interaction.user.id)
		.then((res) => {
			if (!res || res.length < 1) {
				return Promise.resolve({ embeds: [] });
			}
			console.log('list res ', res);
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

async function block(interaction) {
	const args = interaction.options.data;
	// if user specified a server, only block seller on that server
	if (args && args.length > 1) {
		return await db.blockSellerGlobally(interaction.user.id, args[0].value, args[1].value)
			.then((res) => {
				const embeds = blockBuilder([{ seller: args[0].value, server: [args[1].value] }]);
				const metadata = res.user_blocks[0];
				return Promise.resolve({ content: `No longer notifying you about auctions from ${args[0].value} on ${formatCapitalCase(args[1].value)} Server.`, embeds, metadata });
			})
			.catch((err) => {
				return Promise.reject(err);
			});
	}
	// otherwise, block seller on both servers
	else {
		return await db.blockSellerGlobally(interaction.user.id, args[0].value)
			.then((res) => {
				console.log('blockSellerGlobally res = ', res);
				const embeds = blockBuilder([{ seller: args[0].value, server: ['GREEN', 'BLUE'] }]);
				// TODO: handle this more elegantly that searching for blocks based on user/seller
				const metadata = res.user_blocks[0];
				return Promise.resolve({ content: `No longer notifying you about auctions from ${formatCapitalCase(args[0].value)} on either server.`, embeds, metadata });
			})
			.catch((err) => {
				return Promise.reject(err);
			});
	}
}

async function unblock(interaction) {
	const args = interaction.options.data;
	console.log('args = ', args);
	// if user specified a server, only unblock seller on that server
	if (args && args.length > 1) {
		return await db.unblockSellerGlobally(interaction.user.id, args[0].value, args[1].value).then((res) => {
			return Promise.resolve({ content: `People change.  No longer blocking ${formatCapitalCase(args[0].value)} on ${formatCapitalCase(args[1].value)} server.` });
		});

	}
	// unblock on all servers
	return await db.unblockSellerGlobally(interaction.user.id, args[0].value).then((res) => {
		return Promise.resolve({ content: `People change.  No longer blocking ${formatCapitalCase(args[0].value)} on either server.` });
	});
}

async function blocks(interaction) {
// reduce those blocks to be green / blue / both
// build block messages and pass along metadata


	// TODO: add filter argument
	const args = interaction.options.data;
	// get blocks from db
	return await db.showBlocks(interaction.user.id).then((res) => {
		console.log('showBlocsk res ', res);
		if (res.user_blocks.length === 0 && res.watch_blocks.length === 0) {
			return ({ content: 'You haven\'t blocked any sellers.  Use `!block seller, server` to block a seller on all watches, or react with the `🔕` emoji on a watch notification to block a seller only for a certain item.' });
		}
		const user_blocks = dedupeBlockResults(res.user_blocks);
		const embeds = blockBuilder(user_blocks.concat(res.watch_blocks));
		const metadata = user_blocks.concat(res.watch_blocks);
		return Promise.resolve({ embeds, metadata });
	});
}

async function snooze(interaction) {
	const command = interaction.options.getSubcommand();
	const item = interaction.options.getString('item');
	// TODO: also get server if supplied
	switch (command) {
	case 'all':
		// snooze all
		return await db.snooze('global', interaction)
			.then(async () => {
				return { content: 'All your watches have been snoozed.' };
			})
			.catch(async (err) => {
				Promise.reject(err);
			});
	case 'watch':
		// snooze watch
		return await db.snoozeByItemName(interaction.user.id, item)
			.then(async ({ results, metadata }) => {
				if (!results || results.length < 1) {
					return { content: `You don't have any watches for ${item}. Confirm watches with \`/list.\`` };
				}
				console.log('snooze watch res = ', results);
				const embeds = await watchBuilder([results]);
				return { content: 'Your `' + item + '` watch has been snoozed.', embeds, metadata };
			})
			.catch((err) => {
				Promise.reject(err);
			});
	default:
		return;
	}
}

async function unsnooze(interaction) {
	const command = interaction.options.getSubcommand();
	const item = interaction.options.getString('item');
	// TODO: accept server argument
	switch (command) {
	case 'watches':
		// unsnooze all
		return await db.unsnooze('GLOBAL', interaction.user.id)
			.then(() => {
				return Promise.resolve({ content: 'All watches unsnoozed - rise and grind!' });
			})
			.catch((err) => {
				Promise.reject(err);
			});
	case 'watch':
		// snooze watch
		return await db.unsnoozeByItemName(interaction.user.id, item)
			.then(async ({ results, metadata }) => {
				console.log('results = ', results);
				if (!results || results.length < 1) {
					return Promise.resolve({ content: `You don't have any watches for ${item}. Confirm watches with \`/list.\`` });
				}
				const embeds = await watchBuilder([results]);
				return Promise.resolve({ content: 'Your `' + item + '` watch has been un	snoozed.', embeds, metadata });
			})
			.catch((err) => {
				Promise.reject(err);
			});
	default:
		return;
	}
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
	unwatchAll,
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