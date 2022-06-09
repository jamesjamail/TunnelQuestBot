/* eslint-disable indent */
const db = require('../db/db.js');
const {
	MessageActionRow,
	MessageButton,
} = require('discord.js');
const { formatCapitalCase, removeLogTimestamp } = require('../utility/utils.js');
const { fetchImageUrl, fetchWikiPricing } = require('../utility/wikiHandler.js');
const moment = require('moment');
const sslRootCAs = require('ssl-root-cas');
sslRootCAs
	.inject()
	.addFile(__dirname + '../../../Certificates/SectigoRSADomainValidationSecureServerCA.crt');
const wiki_url = require('../utility/data/items.json');
const Discord = require('discord.js');
const SERVER_COLOR = { BLUE: '#1C58B8', GREEN: '#249458', BOTH: "#000" };
const settings = require('../settings/settings.json');


const MessageType = {
	0: 'WATCH',
	1: 'LIST',
    2: 'NOTIFICATION',
};

//TODO: cases for each button id should be handled in separate files (cleanup)
async function collectButtonInteractions(interaction, metadata, message) {	
	//filter button interactions to the interaction they are attached to
	const filter = input => {
		if (message) {
			return input.message.id === message.id;
		}
		return input.message.interaction.id === interaction.id;
	};
	// if message is supplied, buttons are being used on a direct message
	const collector = message ?
	message.createMessageComponentCollector({ filter, time: 30 * 60000 })
	: interaction.channel.createMessageComponentCollector({ filter, time: 30 * 60000 });
	collector.on('collect', async i => {
		// TODO: check status of other buttons other than assuming inactive
		switch (i.customId) {
			case 'globalRefresh':
				return await db.extendAllWatches(interaction.user.id)
					.then(async (res) => {
							const updatedMsg = buildListResponse(res);
							const btnRow = buttonBuilder([{ type: 'globalSnooze', active: res[0].global_snooze }, { type: 'globalRefresh', active: true }]);
							return await i.update({ content: 'All watches extended another 7 days!', embeds: updatedMsg, components: [btnRow] });
						})
						.catch(async (err) => {
							return await gracefulError(i, err);
						});
			case 'globalSnooze':
				// use listWatches to check global_snooze state (state may have changed since issuing command)
				return await db.listWatches(interaction.user.id)
						.then(async (res) => {
							const globalRefreshActive = isRefreshActive(res[0].datetime);
							// TODO: handle no watch edge case
							if (res && res.length > 0 && res[0]['global_snooze']) {
								// unsnooze if already snoozed
								return await db.unsnooze('global', interaction.user.id)
									.then(async (res) => {
											const updatedMsg = buildListResponse(res);
											const btnRow = buttonBuilder([{ type: 'globalSnooze' }, { type: 'globalRefresh', active: globalRefreshActive }]);
											return await i.update({ content: 'All watches unsnoozed.', embeds: updatedMsg, components: [btnRow] });
										})
										.catch(async (err) => {
											return await gracefulError(i, err)
										});
							}
							return await db.snooze('global', interaction.user.id)
								.then(async (res) => {
										const updatedMsg = buildListResponse(res);
										const btnRow = buttonBuilder([{ type: 'globalSnooze', active: true }, { type: 'globalRefresh', active: globalRefreshActive }]);
										return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
									})
									.catch(async (err) => {
										return await gracefulError(i, err)
									});
						});

			case 'itemSnooze':
				return await db.showWatchById(metadata.id)
								.then(async (watch) => {
									// if already snoozed, unsnooze
									if (watch.snoozed) { //careful, snoozed vs itemSnooze is ambiguously used
										return await db.unsnooze('item', metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
										.then(async (res) => {
												const updatedMsg = await watchBuilder([res]);
												const buttonConfig = metadata.seller ? //if there is a seller property, it's a watch notification and not watch result
													// include block seller button for watch notifications
													[{ type: 'itemSnooze', active: watch.itemSnooze }, { type: 'unwatch', }, {type: 'watchBlock'}, { type: 'itemRefresh' }]
													:
													[{ type: 'itemSnooze', active: watch.itemSnooze }, { type: 'unwatch' }, { type: 'itemRefresh' }]

												const btnRow = buttonBuilder(buttonConfig);
												return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
											})
											.catch(async (err) => {
												return await gracefulError(i, err)
											});
									}
									// if not already snoozed, snooze
									return await db.snooze('item', metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
										.then(async (res) => {
												const updatedMsg = await watchBuilder([res]);
												const itemRefreshActive = isRefreshActive(res.datetime);
												const buttonConfig = metadata.seller ? //if there is a seller property, it's a watch notification and not watch result
													// include block seller button for watch notifications
													[{ type: 'itemSnooze', active: true }, { type: 'unwatch', }, {type: 'watchBlock'},{ type: 'itemRefresh', active: itemRefreshActive }]
													:
													[{ type: 'itemSnooze', active: true }, { type: 'unwatch', }, { type: 'itemRefresh', active: itemRefreshActive }]

												const btnRow = buttonBuilder(buttonConfig);
												return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
											})
											.catch(async (err) => {
												return await gracefulError(i, err)
											});
								});


			case 'itemRefresh':
				return await db.extendWatch(metadata.id)
				.then(async (res) => {
						const updatedMsg = await watchBuilder([res]);
						const itemRefreshActive = isRefreshActive(res.datetime);
						const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh', active: itemRefreshActive }]);
						return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });
					})
					.catch(async (err) => {
						return await gracefulError(i, err)
					});
			case 'unwatch':
				//first get status to determine if unwatching or undoing an unwatch button command
				return await db.showWatchById(metadata.id)
					.then(async (watch) => {
						//if watch is active, unwatch it
						if (watch.active) {
							return await db.endWatch(null, null, null, metadata.id)
							.then(async (res) => {
								const updatedMsg = await watchBuilder([res]);
								const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh' }]);
								//snoozing an inactive watch is a confusing user experience, so let's disable the button
								btnRow.components[0].setDisabled(true);
								return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });

							})
							.catch(async (err) => {
								return await gracefulError(i, err);
						});
						}
						//otherwise watch is inactive, meaning a user is undoing a previous unwatch cmd
						return await db.extendWatch(metadata.id)
							.then(async (res) => {
								const updatedMsg = await watchBuilder([res]);
								const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh' }]);
								return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });

							})
							.catch(async (err) => {
								return await gracefulError(i, err);
							});
					})
					case 'globalUnblock':
						//for watches we give the users the ability to undo an unwatch button press.
						// this is useful for misclicks
						// however because /blocks is used so rarely, and the fact that we don't have an active
						// column in the table like we do for watches, let's just delete the message.
						return await db.unblockSellerGlobally(interaction.user.id, metadata.seller)
							.then(async () => {
								return await i.update({ content: `The block on \`${metadata.seller}\` has been removed.`, embeds: [], components: [] });
							})
							.catch(async (err) => {
								return await gracefulError(i, err);
							});
					case 'watchUnblock':
						return await db.unblockSellerByWatchId(metadata.watch_id)
						.then(async () => {
							return await i.update({ content: `The block on \`${metadata.seller}\` for this watch has been removed.`, embeds: [] });
						})
						.catch(async (err) => {
							return await gracefulError(i, err);
						});
					case 'watchBlock':
						// TODO: should be able to unblock a seller
						return await db.showBlocks(interaction.user.id, metadata.seller)
							.then((blocks) => {
								if (blocks.watch_blocks.length > 0) {
									blocks.watch_blocks.forEach(async (block) => {
										if (block.watch_id === metadata.id) {
											//player is currently blocked
											return await db.unblockSellerByWatchId(metadata.id, metadata.seller)
											.then(async () => {
												return await db.showWatchById(metadata.id)
													.then(async (watch) => {
														const btnRow = buttonBuilder([{ type: 'itemSnooze', active: watch.snoozed }, { type: 'unwatch', active: watch.active }, {type: 'watchBlock'}, { type: 'itemRefresh' }]);
														return await i.update({ content: `Auctions from \`${formatCapitalCase(metadata.seller)}\` have been blocked for this watch.` , components: [btnRow]});
													})

											})
											.catch(async (err) => {
												return await gracefulError(i, err);
											});
										} else {
											return await db.blockSellerByWatchId(metadata.id, metadata.seller)
											.then(async () => {
												return await db.showWatchById(metadata.id)
													.then(async (watch) => {
														// TODO: check snooze and unwatch status - don't assume
														const btnRow = buttonBuilder([{ type: 'itemSnooze', active: watch.snoozed }, { type: 'unwatch', active: watch.active }, {type: 'watchBlock', active: true}, { type: 'itemRefresh' }]);
														return await i.update({ content: `Auctions from \`${formatCapitalCase(metadata.seller)}\` have been blocked for this watch.` , components: [btnRow]});
													})

											})
											.catch(async (err) => {
												return await gracefulError(i, err);
											});
										}
									})
								}
							})
						
			default:
				return null;
		}
	});
}

//for updating refresh button state
function isRefreshActive(datetime) {
	const created = moment(datetime).add(0, 'second');
	const twoSecsAgo = moment().subtract('2', 'seconds');
	return created.isAfter(twoSecsAgo);
}

function buildListResponse(data) {
	if (data && data.length > 0) {
		const globalSnooze = data[0].global_snooze;
		const watches = [];
		data.forEach(watch => {
			const expiration = moment(watch.datetime).add(7, 'days');
			const now = moment(new Date);
			const diff = expiration.diff(now);
			const diffDuration = moment.duration(diff);
			const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp');
			watches.push({
				name: `\`${watch.watch_snooze || globalSnooze ? '💤 ' : ''}${formatCapitalCase(watch.name)}\` | \`${price}\` | \`${formatCapitalCase(watch.server)}\``,
				value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
				inline: false,
			});
		});
		const embed = new Discord.MessageEmbed()
			.setTitle(globalSnooze ? '__Active Watches (Global Snooze Active)__' : '__Active Watches__')
			.addFields(watches);
		return [embed];
	}
	else {
		return 'You don\'t have any watches.  Add some with /watch';
	}
}

async function watchBuilder(watchesToBuild) {
	const urls = await Promise.all(watchesToBuild.map(async (item) => {
		return await fetchImageUrl(item.name);
	}));

	const embeds = watchesToBuild.map((watch, index) => {
		const watches = [];
		const expiration = moment(watch.datetime).add(7, 'days');
		const now = moment(new Date);
		const diff = expiration.diff(now);
		const diffDuration = moment.duration(diff);
		const snoozeExpiration = moment(watch.expiration).add(0, 'seconds');
		const snoozeDiff = snoozeExpiration.diff(now);
		const snoozeDuration = moment.duration(snoozeDiff);
		const price = watch.price == -1 || watch.price == null ? 'No Price Criteria' : watch.price.toString().concat('pp');
		const item = formatCapitalCase(watch.name);
		const server = `${formatCapitalCase(watch.server)} Server`;
		// const url = await fetchImageUrl(item).catch(console.error);

		watches.push({
			name: `${price}   |   ${server}`,
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
			.setAuthor({ name: `Auction Watch`, url: href, iconURL: urls[index] })
			.addFields(watches)
			.setTitle(formatCapitalCase(watch.name))
			.setFooter({ text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻' })


	});
	return Promise.resolve(embeds);
}

async function watchNotificationBuilder({item, price, server, seller, fullAuction, timestamp}) {
	const url = await fetchImageUrl(item).catch(console.error);
	const formattedPrice = price ? `${price}pp` : 'No Price Listed';
	const historical_pricing = await fetchWikiPricing(item, server);

	const fields = [];

	fields.push({
		name: formattedPrice || 'No Price Listed',
		value: `${formatCapitalCase(item)}`,
		inline: false,
	});

	if (historical_pricing) {
		fields.push({
			name: 'Historical Pricing Data',
			value: historical_pricing,
			inline: false,
		});
	}

	const msg = new Discord.MessageEmbed()
		.setColor(SERVER_COLOR[server])
		.setImage(url === 'https://i.imgur.com/wXJsk7Y.png' ? null : url)
		.setTitle(`${formatCapitalCase(item)}`)
		.setAuthor('Watch Notification', url, wiki_url[item] ? `https://wiki.project1999.com${wiki_url[item]}` : null)
		.setDescription(`**${seller}** is currently selling **${formatCapitalCase(item)}** ${price ? 'for **' + price + 'pp**' : ''} on Project 1999 **${formatCapitalCase(server)}** server. \n\n\`\`${removeLogTimestamp(fullAuction)}\`\``)
		.addFields(fields)
		.setFooter(`To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo ignore auctions by this seller, click 🔕\nTo extend this watch, click ♻\nWatch expires ${moment(timestamp).add(7, 'days').fromNow()}`)
		.setTimestamp();

	return Promise.resolve([msg]);
}

function blockBuilder(blocksToBuild) {
	const embeds = blocksToBuild.map((block, index) => {
		const blocks = [];
		// eventaully this will need to be refactored in order to run more than 2 servers
		const server = block.server.length > 1 ? `All Servers` : `${formatCapitalCase(block.server[0])} Server` ;

		//name is item name - meaning it's a watch block
		if (block.name) {
			blocks.push({
				name: `${formatCapitalCase(block.seller)}`,
				value: `${formatCapitalCase(block.name)} | ` +` ${formatCapitalCase(block.server)} Server`,
				inline: false,
			});	
		} else {
			blocks.push({
				name: `${formatCapitalCase(block.seller)}`,
				value: `${formatCapitalCase(server)}`,
				inline: false,
			});
		}

		return new Discord.MessageEmbed()
			.setColor(SERVER_COLOR[block.server])
			.addFields(blocks)
			.setTitle(block.name ? 'Watch Block' : 'Global Block')
			.setFooter({ text: 'To remove this block, click ❌' });


	});
	return embeds;
}

function buttonBuilder(buttonTypes) {
	const row = new MessageActionRow();
	const buttons = buttonTypes.map((button) => {
		switch(button.type) {
			case 'itemSnooze':
				return new MessageButton()
					.setCustomId('itemSnooze')
					.setLabel('💤')
					.setStyle(button.active ? 'PRIMARY' : 'SECONDARY');
			case 'globalSnooze':
				return new MessageButton()
						.setCustomId('globalSnooze')
						.setLabel('💤')
						.setStyle(button.active ? 'PRIMARY' : 'SECONDARY');
			case 'unwatch':
				return new MessageButton()
					.setCustomId('unwatch')
					.setLabel('❌')
					.setStyle(button.active ? 'DANGER' : 'SECONDARY');

			case 'itemRefresh':
				return new MessageButton()
					.setCustomId('itemRefresh')
					.setLabel('♻️')
					.setStyle(button.active ? 'SUCCESS' : 'SECONDARY');

			case 'globalRefresh':
				return new MessageButton()
					.setCustomId('globalRefresh')
					.setLabel('♻️')
					.setStyle(button.active ? 'SUCCESS' : 'SECONDARY');
			case 'globalUnblock':
				return new MessageButton()
					.setCustomId('globalUnblock')
					.setLabel('❌')
					.setStyle(button.active ? 'SUCCESS' : 'SECONDARY');
			case 'watchBlock':
				return new MessageButton()
					.setCustomId('watchBlock')
					.setLabel('🔕')
					.setStyle(button.active ? 'SUCCESS' : 'SECONDARY');
			case 'watchUnblock':
				return new MessageButton()
					.setCustomId('watchUnblock')
					.setLabel('❌')
					.setStyle(button.active ? 'SUCCESS' : 'SECONDARY');
			default:
				return null;

		}
	});
	return row.addComponents(buttons);
}

function dedupeBlockResults(blockResults) {
	const blockMap = {};
	blockResults.map((block) => {
		if (blockMap[block.seller]) {
			return blockMap[block.seller] = [...blockMap[block.seller], block.server]
		}
		return blockMap[block.seller] = [block.server];
	})
	return Object.keys(blockMap).map((dedupedBlock) => {
		//just plucking the userId off the first result isn't great, but we'll
		// never use this command for multiple users
		return {user_id: blockResults[0].user_id, seller: dedupedBlock, server: blockMap[dedupedBlock]}
	})
}

//	to be used to handle errors at the top level in command files.
// 	there is one last try catch block outside the command files as a fail safe
// 	ideally executors and clientHelpers should not catch any errors so they bubble up
const gracefulError = async (interaction, err) => {
	// log to console as a safety
	console.error(err.message)
	// inform user an error occured
	await interaction.reply("Sorry, an error occured.  Please try again.")
	// pass thru to error log channel
	const channelId = settings.discord.logs;
	const logsChannel = await interaction.client.channels.fetch(channelId)
	logsChannel.send(`${interaction.user.username} threw the following error:\n\n${err.message}`)
}


async function sendMessagesToUser(interaction, userId, messages, components, metadataItems) {
	const user = await interaction.client.users.fetch(userId).catch(console.error);
	if (!messages || messages.length < 1) return;
	const postedMessages = await Promise.all(messages.map(async (message, index) => {
		return await user.send({ embeds: [message], components: [components[index]] })
			.then(async (postedMessage) =>{
				return await collectButtonInteractions(interaction, metadataItems[index], postedMessage);
			});
		}));

	return postedMessages;
}


module.exports = { MessageType, watchBuilder, buttonBuilder, blockBuilder, sendMessagesToUser, collectButtonInteractions, buildListResponse, isRefreshActive, dedupeBlockResults, gracefulError, watchNotificationBuilder };