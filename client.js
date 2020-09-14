const Discord = require('discord.js');
const logger = require('winston');
const settings = require('./settings.json');
const { helpMsg, welcomeMsg } = require('./messages')
const db = require('./db.js');
const { fetchAndFormatAuctionData, fetchImageUrl } = require("./wikiHandler");
const { SERVER_COLOR } = require('./wikiHandler')
const { formatCapitalCase, removeLogTimestamp, formatItemNameForWiki } = require('./utils')
const moment = require('moment');
// logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Client
const bot = new Discord.Client();
const TOKEN = settings.discord.token;
const GUILD = settings.discord.guild;
const COMMAND_CHANNEL = settings.discord.command_channel;
const GENERAL_CHANNEL = settings.discord.general_channel;

bot.on('ready', () => {
    logger.info(`Logged in as ${bot.user.tag}!`);
});

//server greeting for users who join
bot.on('guildMemberAdd', (member) => {
    let guild = member.guild; // Reading property `guild` of guildmember object.
    let memberTag = member.user.tag; // GuildMembers don't have a tag property, read property user of guildmember to get the user object from it
    bot.channels.cache.get(GENERAL_CHANNEL).send(`Welcome to the server, ${memberTag}!`)
    bot.users.cache.get(member.user.id).send(`**Hi ${memberTag}!**\n\n` + welcomeMsg);
})

bot.on('message', function (message) {
    // console.log(message);

    // ignore bots
    if (message.author.bot){
        return;
    }
    
    // listen for messages that will start with `!`
    if (message.content.startsWith('!')) {
        console.log(message.content);
        let colIndex = message.content.indexOf(':');
        let cmd;
        let args;
        if (colIndex === -1) {
            cmd = message.content.substring(1).toUpperCase().trim();
        } else {
            cmd = message.content.substring(1, colIndex).toUpperCase();
            args = message.content.substring(colIndex+1).toUpperCase().split(',');
            args.forEach((elem, index, array) => array[index] = elem.trim().replace(/[<>"\{\}\[\]]/g, ''));
        }

        switch(cmd) {

            case 'PING':
                pingUser(1, message.userID, args[1], args[0], null, 'GREEN', `WTS ${args[0]}`)
                break;
            // !help
            case 'HELP':
                message.author.send('Thanks for using TunnelQuestBot! ' + helpMsg)
                break;

            // !add watch <item>
            case 'ADD WATCH':
                // console.log('add watch command received.  args = ', args)
                if (args === undefined || args[0] === undefined || args[1] === undefined) {
                    message.author.send(`Sorry, it looks like your missing some arguments.  Please specify ITEM, PRICE, SERVER in that order separated by commas.  Try "!help" for syntax structure.`)
                } else if (args[2] === undefined && args[1].toUpperCase().includes('GREEN') || args[2] === undefined && args[1].toUpperCase().includes('BLUE')) {
                    message.author.send(`Got it! Now watching auctions for \`${args[0]}\` at \`ANY PRICE\` on Project 1999 \`${args[1]}\ server\`.`)
                    args[2] = args[1];
                    args[1] = -1;
                    db.addWatch(message.author.id, args[0], args[1], args[2]);
                } 
                else if (args[2] !== undefined && args[2].toUpperCase() !== 'GREEN' && args[2].toUpperCase() !== 'BLUE') {
                    message.author.send(`Sorry, I don't recognize the server name ${args[2]}.  Please try "green" or "blue"`);
                } else {
                    db.addWatch(message.author.id, args[0], args[1], args[2]);
                    message.author.send(`Got it! Now watching auctions for \`${args[0]}\` at \`${args[1]}pp\` or less on Project 1999 \`${args[2]} server\`.`)
                }
                break;

            // !end watch: <item>, <server>
            case 'END WATCH':
                // console.log('end watch command received.  args = ', args)
                if (args === undefined || args[0] === undefined || args[1] === undefined) {
                    message.author.send('Please specify both \`item\` and \`server\` to end a watch, or use "!end all watches" to end all watches.')
                } else {
                    db.endWatch(message.author.id, args[0], args[1]);
                    message.author.send(`Got it! No longer watching auctions for \`${args[0]}\` on Project 1999 \`${args[1]} server\`.`);
                }
                break;

            // !show watch: <item>
            case 'SHOW WATCH':
                // console.log('show watch command received.  args = ', args)
                
                db.showWatch(message.author.id, args[0], (res) => {
                    if (res.success) {
                        console.log(res.data)
                        res.data.forEach(async (watch) => {
                            let watches = [];
                            const url = await fetchImageUrl(watch.name).catch(console.error);
                            const expiration = moment(watch.datetime).add(7, 'days');
                            const now = moment(new Date);
                            const diff = expiration.diff(now)
                            const diffDuration = moment.duration(diff)
                            const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp')
                            watches.push({
                                name: `${formatCapitalCase(watch.name)} | ${price} | ${formatCapitalCase(watch.server)}`,
                                value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
                                inline: false
                            })
                            message.author.send(
                                new Discord.MessageEmbed()
                                .setColor(SERVER_COLOR[watch.server])
                                .setAuthor(`${formatCapitalCase(watch.name)}`, url, `https://wiki.project1999.com/${formatItemNameForWiki(watch.name)}`)
                                .addFields(watches)
                                .setFooter(`To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻`)
                            )
                            .then((message) => {
                                message
                                .react('💤')                     // for "snooze watch"
                                .then(() => message.react('❌')) // for "delete watch"
                                .then(() => message.react('♻'))  // for "extend watch"
                                .then(() => {
                                    const react_filter = (reaction, user) => {
                                        if (user.bot) {
                                            return;
                                        }
                                        return reaction.emoji.name === '💤' || reaction.emoji.name === '❌' || reaction.emoji.name === '♻';
                                    }
                                    const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24 , dispose: true});
                                    collector.on('collect', (reaction, user) => {
                                        switch (reaction.emoji.name) {
                                            //TODO: when an emoji is clicked, remove and add the opposite (undo) function.
                                            case '💤': //alt: 🔕
                                                // Snooze this watch for 6 hours
                                                // db.snooze('watch');
                                                user.send(`Sleep is good.  Pausing notifications for the next 6 hours on this watch.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze all\`\``).catch(console.error);
                                                break;
                                            case '❌':
                                                // Delete this watch
                                                db.endWatch(user.id, item, server);
                                                user.send(`Got it! No longer watching auctions for ${formattedItem} on P1999 ${server} server.`);
                                                break;
                                            case '🔕':
                                                // Ignore this seller's auctions for this watch
                                                // db.blockSeller(user.id, seller, watchId)
                                                user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${seller} with regard to this watch.\n  To block ${seller} on all present and future watches, use \`\`!add block: ${seller}`);
                                                break;
                                            case '♻': //extend watch
                                                console.log('extend watch')
                                                // db.extendWatch(watchId)
                                                user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${formattedItem}\`\` watch.`);
                                                break;
                                            default:
                                                break;
                                        }
                                    })
                                    collector.on('remove', (reaction, user) => {
                                        switch (reaction.emoji.name) {
                                            //TODO: when an emoji is clicked, remove and add the opposite (undo) function.
                                            // 👋 🛑 🛎 ⏰ 🔔 ▶ ⏯ ⏸ 🔁 ♻ ✔ 💣
                                            case '💤': //alt: 🔕
                                                // Snooze this watch for 6 hours
                                                // db.unsnooze('watch');
                                                user.send(`U woke me tf up - nice!`).catch(console.error);
                                                break;
                                            case '❌':
                                                // Delete this watch
                                                db.endWatch(user.id, item, server);
                                                user.send(`Got it! No longer watching auctions for ${item} on P1999 ${server} server.`);
                                                break;
                                            case '🔕':
                                                // Ignore this seller's auctions for this watch
                                                // db.blockSeller(user.id, seller, watchId)
                                                user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${seller} with regard to this watch.\n  To block ${seller} on all present and future watches, use \`\`!add block: ${seller}`);
                                                break;
                                            default:
                                                break;
                                        }
                                    })
                                })
                            });
                        })
                    }  else {
                        message.author.send(`You don\'t have any watches for ${args[0]}.`);
                    }
                });
                
                break;

            // !show watches
            case 'SHOW WATCHES':
                db.showWatches(message.author.id, (res) => {
                    if (res.success) {
                        let watches = [];
                        res.msg.forEach(watch => {
                            const expiration = moment(watch.datetime).add(7, 'days');
                            const now = moment(new Date);
                            const diff = expiration.diff(now)
                            const diffDuration = moment.duration(diff)
                            const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp')
                            watches.push({
                                name: `\`${formatCapitalCase(watch.name)}\` | \`${price}\` | \`${formatCapitalCase(watch.server)}\``,
                                value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
                                inline: false
                            })
                        })
                        message.author.send(
                            new Discord.MessageEmbed()
                            .setColor('#d500f9')
                            .setTitle(`__Active Watches__`)
                            .addFields(watches)
                        )
                        .catch(console.error);
                    }  else {
                        message.author.send("You don\'t have any watches.  Add some with `!add watch:`");
                    }
                });
                break;

            // !end all watches
            case 'END ALL WATCHES':
                // console.log('end all watches command received.  args = ', args)
                db.endAllWatches(message.author.id);
                message.author.send('All watches succesfully ended.');
                break;

            // !extend all watches
            case 'EXTEND ALL WATCHES':
                // console.log('extend all watches command received.  args = ', args)
                db.extendAllWatches(message.author.id);
                message.author.send('All watches succesfully extended for another 7 days.');
                break;

            // !add block
            case 'ADD BLOCK':
                if (args[1] === 'BLUE' || args[1] === 'GREEN') {
                    db.blockSeller(message.author.id, args[0], null, server)
                    message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${seller} on ${server} for any current or future watches.`);
                } else {
                    db.blockSeller(message.author.id, args[0], null, null)
                    message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${seller} on both servers for any current or future watches.  To only block this seller on one server, use \`\`!add block: ${seller}, server`);
                }
                break;

            //TODO:
            case 'DELETE BLOCK':
                if (args[1] === 'BLUE' || args[1] === 'GREEN') {
                    db.unblockSeller(message.author.id, args[0], null, server)
                } else {
                    db.unblockSeller(message.author.id, args[0], null, null)
                }
                break;

            //TODO:
            case 'SHOW BLOCKS':
                //TODO: format an embedded message for all blocks, user and watch
                break;
            // TODO:
            case 'SNOOZE ALL':
                //TODO: snooze all watches based on argument or default
                break;
            case 'UNSNOOZE ALL':
                //TODO: unsnooze all watches
                break;
            case 'GNOME FACT':
                //TODO: deliver gnome fact based on # provided or random if no number
                break;
            case 'TIP':
                //TODO: deliver tip based on # provided or random if no number
                break;

            // default: command not recognized...
            default:
                message.author.send('Sorry, I didn\'t recognized that command.  Please check your syntax and try again. ' + helpMsg);
                break;
        }
        // message the general channel that commands are not recognized in this channel if command detected:
        if (!message.author.bot && message.channel.type === 'text' && message.channel.id !== COMMAND_CHANNEL){
            bot.channels.cache.get(COMMAND_CHANNEL).send(`Hi <@${message.author.id}>, I received your command but deleted it from the \`general\` channel to keep things tidy.  In the future, please use this channel instead or send me a direct message.  Thanks!`)
            message.delete();
        }
    }
    else if (message.channel.id === COMMAND_CHANNEL || message.channel.type === 'dm') {
        message.author.send('I\'d love to chat, but I\'m just a dumb bot.  Try !help');
    }   
})

async function pingUser (watchId, user, userId, seller, item, price, server, fullAuction, timestamp) {
    //query db for communication history and blocked sellers - abort if not valid
    const validity = await db.validateWatchNotification(userId, watchId, seller)
    if (!validity) return;

    const url = await fetchImageUrl(item).catch(console.error);
    const formattedPrice = price ? `${price}pp` : 'No Price Listed' ;
    const formattedItem = formatCapitalCase(item);
    let msg = new Discord.MessageEmbed()
        .setColor(SERVER_COLOR[server])
        .setImage(url === `https://i.imgur.com/wXJsk7Y.png` ? null : url)
        .setTitle(`${formatCapitalCase(item)}`)
        .setAuthor('Watch Notification', url, `https://wiki.project1999.com/${formatItemNameForWiki(item)}`)
        .setDescription(`**${seller}** is currently selling **${formatCapitalCase(item)}** ${price ? 'for **' + price + 'pp**' : ''} on Project 1999 **${formatCapitalCase(server)}** server. \n\n\`\`${removeLogTimestamp(fullAuction)}\`\``)
        .addField(formattedPrice || 'No Price Listed', formatCapitalCase(item), false)
        // .addField(`Watch expires: ${expiration.toLocaleString()}`)
        .setFooter(`To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo ignore auctions by this seller, click 🔕\nTo extend this watch, click ♻\nWatch expires ${moment(timestamp).add(7, 'days').fromNow()}`)
        .setTimestamp()
    if (bot.users.cache.get(user.toString()) === undefined) {
        console.log('sending msg to user ', user)
        bot.guilds.cache.get(GUILD).members.fetch(user.toString()).then((res)=>{res.send(msg)}).catch((err)=> {console.log(err)});
    } else {
        bot.users.cache.get(user.toString()).send(msg)
        .then(message => {
            message
            .react('💤')                     // for "snooze watch"
            .then(() => message.react('❌')) // for "delete watch"
            .then(() => message.react('🔕')) // for "silence seller"
            .then(() => message.react('♻'))  // for "extend watch"
            .then(() => {
                const react_filter = (reaction, user) => {
                    return reaction.emoji.name === '💤' || reaction.emoji.name === '❌' || reaction.emoji.name === '🔕' || reaction.emoji.name === '♻';
                }
                const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24 , dispose: true});
                collector.on('collect', (reaction, user) => {
                    switch (reaction.emoji.name) {
                        //TODO: when an emoji is clicked, remove and add the opposite (undo) function.
                        case '💤': //alt: 🔕
                            // Snooze this watch for 6 hours
                            // db.snooze('watch');
                            user.send(`Sleep is good.  Pausing notifications for the next 6 hours on this watch.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze all\`\``).catch(console.error);
                            break;
                        case '❌':
                            // Delete this watch
                            db.endWatch(user.id, item, server);
                            user.send(`Got it! No longer watching auctions for ${formattedItem} on P1999 ${server} server.`);
                            break;
                        case '🔕':
                            // Ignore this seller's auctions for this watch
                            // db.blockSeller(user.id, seller, watchId)
                            user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${seller} with regard to this watch.\n  To block ${seller} on all present and future watches, use \`\`!add block: ${seller}`);
                            break;
                        case '♻': //extend watch
                            console.log('extend watch')
                            db.extendWatch(watchId)
                            user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${formattedItem}\`\` watch.`);
                            break;
                        default:
                            break;
                    }
                })
                collector.on('remove', (reaction, user) => {
                    switch (reaction.emoji.name) {
                        //TODO: when an emoji is clicked, remove and add the opposite (undo) function.
                        // 👋 🛑 🛎 ⏰ 🔔 ▶ ⏯ ⏸ 🔁 ♻ ✔ 💣
                        case '💤': //alt: 🔕
                            // Snooze this watch for 6 hours
                            // db.unsnooze('watch');
                            user.send(`U woke me tf up - nice!`).catch(console.error);
                            break;
                        case '❌':
                            // Delete this watch
                            db.endWatch(user.id, item, server);
                            user.send(`Got it! No longer watching auctions for ${item} on P1999 ${server} server.`);
                            break;
                        case '🔕':
                            // Ignore this seller's auctions for this watch
                            // db.blockSeller(user.id, seller, watchId)
                            user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${seller} with regard to this watch.\n  To block ${seller} on all present and future watches, use \`\`!add block: ${seller}`);
                            break;
                        default:
                            break;
                    }
                })
            })
        })
        .catch(console.error);
    }
    //add to communication_history
    db.postSuccessfulCommunication(watchId, seller)
}

function streamAuction (auction_user, auction_contents, server) {
    const channelID = settings.servers[server].stream_channel;
    // console.log(msg, server, channelID);

    fetchAndFormatAuctionData(auction_user, auction_contents, server).then(formattedAuctionMessage => {
        bot.channels.fetch(channelID.toString())
            .then((channel) => {
                // console.log('channel = ', channel)
                channel.send(formattedAuctionMessage)
            })
            .catch(console.error)
    });
}

bot.login(TOKEN);


module.exports = {pingUser, streamAuction}
