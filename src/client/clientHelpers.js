/* eslint-disable indent */
const db = require('../db/db.js');
const {
	MessageActionRow,
	MessageButton
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

async function collectButtonInteractions(interaction) {
	const filter = i => i.customId === 'snooze' || i.customId === 'end';
	const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30 * 60000 });
	collector.on('collect', async i => {
		if (i.customId === 'snooze') {
			await i.update({ content: 'A button was clicked!' });
		}
	});
}

async function watchBuilder({ item, price, server, datetime }) {
	// const urls = await Promise.all(res.data.map(async (item) => {
	// 	return await fetchImageUrl(item.name.toUpperCase())
	// }));

	const url = await fetchImageUrl(item).catch(console.error);


	// const urls = res.data.map((item) => {
	// 	return await fetchImageUrl(item.name.toUpperCase())
	// })

	const watches = [];
	const expiration = moment(datetime).add(7, 'days');
	const now = moment(new Date);
	const diff = expiration.diff(now);
	const diffDuration = moment.duration(diff);
	const snoozeExpiration = moment(expiration).add(0, 'seconds');
	const snoozeDiff = snoozeExpiration.diff(now);
	const snoozeDuration = moment.duration(snoozeDiff);
	const prettyPrice = price === null ? 'No Price Criteria' : price.toString().concat('pp');
	const prettyItem = formatCapitalCase(item);
	const prettyServer = `${formatCapitalCase(server)} Server`;
	watches.push({
		name: `${prettyItem} | ${prettyPrice} | ${formatCapitalCase(server)}`,
		value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
		inline: false,
	});

	// if (watch.snoozed) {
	// 	watches.push({
	// 		name: '💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤',
	// 		value: `Snoozed for another ${snoozeDuration.hours()} hours and ${snoozeDuration.minutes()} minutes`,
	// 		inline: false,
	// 	});
	// }

	const matchingItemName = !!wiki_url[item.toUpperCase()];
	const href = matchingItemName ? `https://wiki.project1999.com${wiki_url[item.toUpperCase()]}` : null;
	console.log('href1 = ', href);
	console.log('url = ', url);

	return Promise.resolve(new Discord.MessageEmbed()
		.setColor(SERVER_COLOR[server])
		.setAuthor({ name: `${prettyItem}`, url: href, iconURL: url })
		.addFields(watches)
		.setTitle(prettyItem)
		.setFooter({ text: 'To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻' }),
		// .setThumbnail(wiki_url[watch.name.toUpperCase()] ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}` : null)
		// .setImage(href)
		// .setThumbnail(url)

	);
}

//TODO: this should accept an array of button names with actinve/inactive bool
function buttonBuilder(messageType) {
	const row = new MessageActionRow();
	switch(messageType) {
		case 'watch':
			const watchBtn1 = new MessageButton()
				.setCustomId('snooze')
				.setLabel('💤')
				.setStyle('PRIMARY');

			const watchBtn2 = new MessageButton()
						.setCustomId('end')
						.setLabel('❌')
						.setStyle('DANGER');


			const watchBtn3 = new MessageButton()
						.setCustomId('refresh')
						.setLabel('♻️')
						.setStyle('SUCCESS');
			return row.addComponents([watchBtn1, watchBtn2, watchBtn3]);
		case 'list':
			const listBtn1 = new MessageButton()
			.setCustomId('snooze')
			.setLabel('💤')
			.setStyle('PRIMARY');


		const listBtn2 = new MessageButton()
					.setCustomId('refresh')
					.setLabel('♻️')
					.setStyle('SUCCESS');
		return row.addComponents([listBtn1, listBtn2]);
		default:
			return;

	}
	return row;
}

async function sendMessagesToUser(client, userId, messages, components) {
	const user = await client.users.fetch(userId)
	messages.forEach((message, index) => {
		if (components) {
			return user.send({ embeds: [message], components: [components] })
		}
		return user.send({ embeds: [message] })
	})
}




module.exports = { MessageType, embedReactions, watchBuilder, buttonBuilder, sendMessagesToUser, collectButtonInteractions };