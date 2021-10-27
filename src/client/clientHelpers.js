/* eslint-disable indent */
const db = require('../db/db.js');
const { formatCapitalCase } = require('../utility/utils.js');

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

module.exports = { MessageType, embedReactions };