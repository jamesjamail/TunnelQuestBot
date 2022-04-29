/* eslint-disable indent */
const db = require('../db/db.js');
const {
	MessageActionRow,
	MessageButton,
} = require('discord.js');
const { formatCapitalCase } = require('../utility/utils.js');
const { fetchImageUrl } = require('../utility/wikiHandler.js');
const moment = require('moment');
const sslRootCAs = require('ssl-root-cas');
sslRootCAs
	.inject()
	.addFile(__dirname + '../../../Certificates/SectigoRSADomainValidationSecureServerCA.crt');
const wiki_url = require('../utility/data/items.json');
const Discord = require('discord.js');
const SERVER_COLOR = { BLUE: '#1C58B8', GREEN: '#249458' };


const MessageType = {
	0: 'WATCH',
	1: 'LIST',
    2: 'NOTIFICATION',
};

function embedReactions(message, data, messageType) {
	switch (messageType) {
	case MessageType[0]:
		message
			.react('💤') // for "snooze watch"
			.then(() => message.react('❌')) // for "delete watch"
			.then(() => message.react('♻')) // for "extend watch"
			.then(() => {
				const react_filter = (reaction, user) => {
					if (user.bot) {
						return;
					}
					return reaction.emoji.name === '💤' || reaction.emoji.name === '❌' || reaction.emoji.name === '♻';
				};
				const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24, dispose: true });
				collector.on('collect', (reaction, user) => {
					switch (reaction.emoji.name) {
					case '💤':
						// Snooze this watch for 6 hours
						db.snooze('watch', data.watchId);
						user.send(`Sleep is good.  Pausing notifications for the next 6 hours on your \`\`${data.item}\`\` watch on \`\`${data.server}\`\`.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze\`\``).catch(console.error);
						break;
					case '❌':
						// Delete this watch
						db.endWatch(null, null, null, data.watchId);
						user.send(`Very well, no longer watching for auctions of \`\`${data.item}\`\`\ on \`\`${data.server}\`\`.`);
						break;
					case '♻': // extend watch
						db.extendWatch(data.watchId);
						user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${data.item}\`\` watch on \`\`${data.server}\`\`.`);
						break;
					default:
						break;
					}
				});
				collector.on('remove', (reaction, user) => {
					switch (reaction.emoji.name) {
					case '💤':
						// unsnooze watch
						db.unsnooze('watch', data.watchId);
						user.send(`Rise and grind.  No longer snoozing on your \`\`${data.item}\`\` watch on \`\`${data.server}\`\`.`).catch(console.error);
						break;
					case '❌':
						// Renew watch
						db.addWatch(null, null, null, null, data.watchId);
						user.send(`Ok, watching for auctions of \`\`${data.item}\`\` on P1999 \`\`${data.server}\`\` again.`);
						break;
					default:
						break;
					}
				});
			});
		break;
	case MessageType[1]:
		message
			.react('💤') // for "snooze (all)"
			.then(() => message.react('♻')) // for "extend (all)"
			.then(() => {
				const react_filter = (reaction, user) => {
					if (user.bot) {
						return;
					}
					return reaction.emoji.name === '💤' || reaction.emoji.name === '♻';
				};
				const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24, dispose: true });
				collector.on('collect', (reaction, user) => {
					if (user.bot) return;
					switch (reaction.emoji.name) {
					case '💤':
						// Snooze account for 6 hours
						db.snooze('user', user.id);
						user.send('Sleep is good.  Pausing notifications for the next 6 hours on all watches.  Click 💤 again to unsnooze.  To snooze an individual watch, use `!watches` and react with the `💤` emoji.')
							.catch(console.error);
						break;
					case '♻': // extend watch
						db.extendAllWatches(user.id);
						user.send('Good things come to those who wait.  I extended all your watches another 7 days.');
						break;
					default:
						break;
					}
				});
				collector.on('remove', (reaction, user) => {
					if (user.bot) return;
					switch (reaction.emoji.name) {
					case '💤':
						// unsnooze all watches
						db.unsnooze('user', user.id);
						user.send('Rise and grind.  Your account is no longer snoozed.').catch(console.error);
						break;
					default:
						break;
					}
				});
			});
		break;
    case MessageType[2]:
        message
        .react('💤') // for "snooze watch"
        .then(() => message.react('❌')) // for "delete watch"
        .then(() => message.react('🔕')) // for "silence seller"
        .then(() => message.react('♻')) // for "extend watch"
        .then(() => {
            const react_filter = (reaction, user) => {
                return reaction.emoji.name === '💤' || reaction.emoji.name === '❌' || reaction.emoji.name === '🔕' || reaction.emoji.name === '♻';
            };
            const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24, dispose: true });
            collector.on('collect', (reaction, user) => {
                if (user.bot) return;
                switch (reaction.emoji.name) {
                case '💤':
                    // Snooze this watch for 6 hours
                    db.snooze('watch', data.watchId);
                    user.send(`Sleep is good.  Pausing notifications for the next 6 hours on your \`\`${data.item}\`\` watch on \`\`${data.server}\`\`.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze\`\``).catch(console.error);
                    break;
                case '❌':
                    // Delete this watch
                    db.endWatch(user.id, data.item, data.server);
                    user.send(`Got it! No longer watching auctions for ${data.item} on P1999 ${data.server} data.server.`);
                    break;
                case '🔕':
                    // Ignore this seller's auctions for this watch
                    db.blockSeller(user.id, data.seller, null, data.watchId);
                    user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${data.seller} with regard to this watch.\n  To block ${data.seller} on all watches, use \`\`!block ${data.seller}\`\``);
                    break;
                case '♻': // extend watch
                    db.extendWatch(data.watchId);
                    user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${data.item}\`\` watch.`);
                    break;
                default:
                    break;
                }
            });
            collector.on('remove', (reaction, user) => {
                if (user.bot) return;
                switch (reaction.emoji.name) {
                case '💤':
                    // unsnooze watch
                    db.unsnooze('watch', data.watchId);
                    user.send(`Rise and grind.  No longer snoozing on your \`\`${data.item}\`\` watch on \`\`${data.server}\`\`.`).catch(console.error);
                    break;
                case '❌':
                    // renew this watch
                    db.addWatch(user.id, null, null, null, data.watchId);
                    user.send(`Got it! Once again watching auctions for ${data.item} on P1999 ${data.server} data.server.`);
                    break;
                case '🔕':
                    // unblock the seller for this auction
                    db.unblockSeller(user.id, data.seller, null, data.watchId);
                    user.send(`People change.  No longer blocking ${formatCapitalCase(data.seller)} with regard to this watch.`);
                    break;
                default:
                    break;
                }
            });
        });
        break;
	default: break;
	}
}

//TODO: cases for each button id should be handled in separate files (cleanup)
async function collectButtonInteractions(interaction, metadata, message) {
	console.log(interaction.replied)
	if (interaction.replied) {
		return;
	}
	console.log('collection metadata ', metadata);

	//filter button interactions to the interaction they are attached to
	const filter = input => {
		console.log(input.message)
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
							console.error(err);
							return await i.update({ content: 'Sorry, an error occurred.', components: [] });
						});
			case 'globalSnooze':
				console.log('BAMBAMBAM')
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
											console.error(err);
											return await i.update({ content: 'Sorry, an error occurred.', components: [] });
										});
							}
							return await db.snooze('global', interaction.user.id)
								.then(async (res) => {
										console.log('globalSnooze res = ', res)

										const updatedMsg = buildListResponse(res);
										const btnRow = buttonBuilder([{ type: 'globalSnooze', active: true }, { type: 'globalRefresh', active: globalRefreshActive }]);
										return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
									})
									.catch(async (err) => {
										console.error(err);
										return await i.update({ content: 'Sorry, an error occurred.', components: [] });
									});
						});

			case 'itemSnooze':
				return await db.showWatchById(metadata.id)
								.then(async (watch) => {
									console.log('itemSnooze watch = ', watch)
									// if already snoozed, unsnooze
									if (watch.snoozed) { //careful, snoozed vs itemSnooze is ambiguously used
										return await db.unsnooze('item', metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
										.then(async (res) => {
												const updatedMsg = await watchBuilder([res]);
												const itemRefreshActive = isRefreshActive(res.datetime);
												const btnRow = buttonBuilder([{ type: 'itemSnooze', active: watch?.itemSnooze }, { type: 'unwatch', active: metadata.active }, { type: 'itemRefresh', active: itemRefreshActive }]);
												return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
											})
											.catch(async (err) => {
												console.error(err);
												return await i.update({ content: 'Sorry, an error occurred.', components: [] });
											});
									}
									// if not already snoozed, snooze
									return await db.snooze('item', metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
										.then(async (res) => {
												const updatedMsg = await watchBuilder([res]);
												const itemRefreshActive = isRefreshActive(res.datetime);
												const btnRow = buttonBuilder([{ type: 'itemSnooze', active: true }, { type: 'unwatch', active: metadata.active }, { type: 'itemRefresh', active: itemRefreshActive }]);
												return await i.update({ content: 'All watches snoozed for 6 hours.', embeds: updatedMsg, components: [btnRow] });
											})
											.catch(async (err) => {
												console.error(err);
												return await i.update({ content: 'Sorry, an error occurred.', components: [] });
											});
								});


			case 'itemRefresh':
				return await db.extendWatch(metadata.id)
				.then(async (res) => {
					console.log('itemRefresh res = ', res);
						const updatedMsg = await watchBuilder([res]);
						const itemRefreshActive = isRefreshActive(res.datetime);
						const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh', active: itemRefreshActive }]);
						return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });
					})
					.catch(async (err) => {
						console.error(err);
						return await i.update({ content: 'Sorry, an error occurred.', components: [] });
					});
			case 'unwatch':
				//first get status to determine if unwatching or undoing an unwatch button command
				return await db.showWatchById(metadata.id)
					.then(async (watch) => {
						console.log('watchg = ', watch)
						//if watch is active, unwatch it
						if (watch.active) {
							console.log('HELLOOOO')
							return await db.endWatch(null, null, null, metadata.id)
							.then(async (res) => {
								console.log('unwatch res = ', res);
								const updatedMsg = await watchBuilder([res]);
								const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh' }]);
								//snoozing an inactive watch is a confusing user experience, so let's disable the button
								btnRow.components[0].setDisabled(true);
								return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });

							})
							.catch(async (err) => {
								console.error(err);
								return await i.update({ content: 'Sorry, an error occurred.', components: [] });
							});
						}
						console.log('hello')
						//otherwise watch is inactive, meaning a user is undoing a previous unwatch cmd
						return await db.extendWatch(metadata.id)
							.then(async (res) => {
								console.log('extendWatch res = ', res);
								const updatedMsg = await watchBuilder([res]);
								const itemRefreshActive = isRefreshActive(res.datetime);
								const btnRow = buttonBuilder([{ type: 'itemSnooze', active: res.snoozed }, { type: 'unwatch', active: !res.active }, { type: 'itemRefresh' }]);
								return await i.update({ content: 'This watch has been extended another 7 days!', embeds: updatedMsg, components: [btnRow] });

							})
							.catch(async (err) => {
								console.error(err);
								return await i.update({ content: 'Sorry, an error occurred.', components: [] });
							});
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
				name: `\`${watch.watch_snooze ? '💤 ' : ''}${formatCapitalCase(watch.name)}\` | ${watch.price === -1 ? '' : ` \`${price}\` | `}\`${formatCapitalCase(watch.server)}\``,
				value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
				inline: false,
			});
		});
		const embed = new Discord.MessageEmbed()
			.setColor('#EFE357')
			.setTitle(globalSnooze ? '__Active Watches (Snoozed)__' : '__Active Watches__')
			.addFields(watches);
		return [embed];
	}
	else {
		return 'You don\'t have any watches.  Add some with /watch';
	}
}

async function watchBuilder(blocksToBuild) {
	console.log('blocksToBuild ', blocksToBuild);
	const urls = await Promise.all(blocksToBuild.map(async (item) => {
		return await fetchImageUrl(item.name);
	}));

	const embeds = blocksToBuild.map((watch, index) => {
		const watches = [];
		const expiration = moment(watch.datetime).add(7, 'days');
		const now = moment(new Date);
		const diff = expiration.diff(now);
		const diffDuration = moment.duration(diff);
		const snoozeExpiration = moment(watch.expiration).add(0, 'seconds');
		const snoozeDiff = snoozeExpiration.diff(now);
		const snoozeDuration = moment.duration(snoozeDiff);
		const price = watch.price == -1 || null ? 'No Price Criteria' : watch.price.toString().concat('pp');
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
	return Promise.resolve(embeds);
}

function blockBuilder(blocksToBuild) {
	console.log('blocksToBuild ', blocksToBuild);

	// const urls = await Promise.all(blocksToBuild.map(async (item) => {
	// 	return await fetchImageUrl(item.name);
	// }));

	const embeds = blocksToBuild.map((watch, index) => {
		const blocks = [];
		const item = formatCapitalCase(watch.name);
		const server = `${formatCapitalCase(watch.server)} Server`;


		blocks.push({
			name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
			value: 'All Watches',
			inline: false,
		});

		// TODO: support watch blocks
		// return ({
		// 	name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
		// 	value: `\`${formatCapitalCase(block.name)}\` Watch`,
		// 	inline: false,
		// });


		// const matchingItemName = !!wiki_url[watch.name.toUpperCase()];
		// const href = matchingItemName ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null;
		return new Discord.MessageEmbed()
			.setColor(SERVER_COLOR[watch.server])
			// .setAuthor({ name: `${formatCapitalCase(watch.name)}`, url: href, iconURL: urls[index] })
			.addFields(blocks)
			.setTitle('Blocked Sellers')
			.setFooter({ text: 'To remove this block, click ❌' });
		// .setThumbnail(wiki_url[watch.name.toUpperCase()] ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null)
		// .setImage(href)
		// .setThumbnail(url)


	});
	return Promise.resolve(embeds);
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

			default:
				return null;

		}
	});
	return row.addComponents(buttons);
}


async function sendMessagesToUser(interaction, userId, messages, components, metadataItems) {
	const user = await interaction.client.users.fetch(userId).catch(console.error);
	if (!messages || messages.length < 1) return;
	console.log('metadataItems = ', metadataItems);
	const postedMessages = await Promise.all(messages.map(async (message, index) => {
		return await user.send({ embeds: [message], components: [components[index]] })
			.then(async (postedMessage) =>{
				return await collectButtonInteractions(interaction, metadataItems[index], postedMessage);
			});
		}));

	return postedMessages;
}


module.exports = { MessageType, embedReactions, watchBuilder, buttonBuilder, sendMessagesToUser, collectButtonInteractions, buildListResponse, isRefreshActive };