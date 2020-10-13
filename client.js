const Discord = require('discord.js');
const logger = require('winston');
const settings = require('./settings.json');
const { helpMsg, welcomeMsg } = require('./messages')
const db = require('./db.js');
const { fetchAndFormatAuctionData, fetchImageUrl, fetchWikiPricing } = require("./wikiHandler");
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
    let memberTag = member.user.tag; // GuildMembers don't have a tag property, read property user of guildmember to get the user object from it
    bot.channels.cache.get(GENERAL_CHANNEL).send(`Welcome to the server, ${memberTag}!`)
    bot.users.cache.get(member.user.id).send(`**Hi ${memberTag}!**\n\n` + welcomeMsg);
})

bot.on('message', function (message) {
    // ignore bots
    if (message.author.bot){
        return;
    }
    
    // listen for messages that will start with `!`
    if (message.content.startsWith('!')) {
        console.log(message.content);
        const spaceIndex = message.content.indexOf(' ');
        let cmd = '';
        let args;
        //allow users to enter single word commands with no spaces
        if (spaceIndex === -1) {
            cmd = message.content.substring(1).toUpperCase();
        } else  {
            cmd = message.content.substring(1, spaceIndex).toUpperCase();
            args = message.content.substring(spaceIndex+1).toUpperCase().split(',');
            args.forEach((elem, index, array) => array[index] = elem.trim().replace(/[<>"\{\}\[\]]/g, ''));
        }

        //if user entered a depreciated command, inform them
        const deprecatedCmds = ['ADD', 'END', 'SHOW'];
        let abort = false;
        deprecatedCmds.forEach((deprecatedCmd) => {
            if (deprecatedCmd === cmd) {
                message.author.send(`It looks like you've entered a deprecated command.  Please see the current commands below:${helpMsg}`)
                abort = true;
            }
        })

        if (abort) return;

        //if user entered a current command ending in ':', inform them and trim the colon off
        const colonCmds = ['WATCH:', 'UNWATCH:', 'BLOCK:', 'UNBLOCK:', 'SNOOZE:', 'UNSNOOZE:', 'LIST:', 'WATCHES:', 'EXTEND:', 'HELP:'];
        colonCmds.forEach((colonCmd) => {
            if (colonCmd === cmd) {
                message.author.send(`Current commands do not require a colon.  I entered your command, but wanted to give you a heads-up.`)
                cmd = cmd.substring(0, cmd.length - 1)
                return;
            }
        })
        switch(cmd) {
            // !help
            case 'HELP':
                message.author.send('Thanks for using TunnelQuestBot! ' + helpMsg)
                break;

            // !watch <item>
            case 'WATCH':
                //required arguments
                if (args === undefined || args[0] === undefined || args[1] === undefined) {
                    message.author.send(`Sorry, it looks like your missing some arguments.  Please specify \`ITEM\` and \`SERVER\`.  Try "!help" for syntax structure.`)
                //validate server
                } else if (args[1].toUpperCase() !== 'GREEN' && args[1].toUpperCase() !== 'BLUE') {
                    message.author.send(`Sorry, I don't recognize the server name ${args[1]}.  Please try \`green\` or \`blue\``);
                // check for price argument
                } else if (args[2] !== undefined && args[2] !== null && args[2] !== '') {
                    db.addWatch(message.author.id, args[0], args[1], args[2]);
                    message.author.send(`Got it! Now watching auctions for \`${args[0]}\` at \`${args[2]}pp\` or less on Project 1999 \`${args[1]} server\`.`)
                //if no price, set watch accordingly
                } else {
                    db.addWatch(message.author.id, args[0], args[1], -1);
                    message.author.send(`Got it! Now watching auctions for \`${args[0]}\` at any price on Project 1999 \`${args[1]} server\`.`)
                }
                break;

            // !unwatch: <item>, <server>
            case 'UNWATCH':
                if (args === undefined || args[0] === undefined || args[1] === undefined) {
                    message.author.send('Please specify both \`item\` and \`server\` to end a watch.')
                //validate server
                } else if (args[1] !== 'GREEN' || args[1] !== 'BLUE') {
                    message.author.send(`Sorry, I don't recognize the server name ${args[1]}.  Please try \`green\` or \`blue\`.`);
                } else {
                // end the watch
                    db.endWatch(message.author.id, args[0], args[1]);
                    message.author.send(`Got it! No longer watching auctions for \`${args[0]}\` on Project 1999 \`${args[1]} server\`.`);
                }
                break;

            // !watches: [search term]
            case 'WATCHES':
                db.showWatch(message.author.id, args && args[0] ? args[0] : '', (res) => {
                    if (res.success) {
                        res.data.forEach(async (watch) => {
                            let watches = [];
                            const url = await fetchImageUrl(watch.name).catch(console.error);
                            const expiration = moment(watch.datetime).add(7, 'days');
                            const now = moment(new Date);
                            const diff = expiration.diff(now)
                            const diffDuration = moment.duration(diff)
                            const snoozeExpiration = moment(watch.expiration).add(0, 'seconds');
                            const snoozeDiff = snoozeExpiration.diff(now)
                            const snoozeDuration = moment.duration(snoozeDiff)
                            const price = watch.price == -1 ? 'No Price Criteria' : watch.price.toString().concat('pp')
                            const item = formatCapitalCase(watch.name)
                            const server = `${formatCapitalCase(watch.server)} Server`
                            watches.push({
                                name: `${formatCapitalCase(watch.name)} | ${price} | ${formatCapitalCase(watch.server)}`,
                                value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
                                inline: false
                            })

                            if (watch.snoozed) {
                                watches.push({
                                    name: `💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤`,
                                    value: `Snoozed for another ${snoozeDuration.hours()} hours and ${snoozeDuration.minutes()} minutes`,
                                    inline: false
                                })
                            }
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
                                            case '💤':
                                                // Snooze this watch for 6 hours
                                                db.snooze('watch', watch.id);
                                                user.send(`Sleep is good.  Pausing notifications for the next 6 hours on your \`\`${item}\`\` watch on \`\`${server}\`\`.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze\`\``).catch(console.error);
                                                break;
                                            case '❌':
                                                // Delete this watch
                                                db.endWatch(null, null, null, watch.id);
                                                user.send(`Very well, no longer watching for auctions of \`\`${item}\`\`\ on \`\`${server}\`\`.`);
                                                break;
                                            case '♻': //extend watch
                                                db.extendWatch(watch.id)
                                                user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${item}\`\` watch on \`\`${server}\`\`.`);
                                                break;
                                            default:
                                                break;
                                        }
                                    })
                                    collector.on('remove', (reaction, user) => {
                                        switch (reaction.emoji.name) {
                                            case '💤':
                                                // unsnooze watch
                                                db.unsnooze('watch', watch.id);
                                                user.send(`Rise and grind.  No longer snoozing on your \`\`${item}\`\` watch on \`\`${server}\`\`.`).catch(console.error);
                                                break;
                                            case '❌':
                                                // Renew watch
                                                db.addWatch(null, null, null, null, watch.id);
                                                user.send(`Ok, watching for auctions of \`\`${item}\`\` on P1999 \`\`${server}\`\` again.`);
                                                break;
                                            case '🔕':
                                                //unblock seller's auctions for this watch
                                                db.unblockSeller(user.id, seller, watch.server, watch.id)
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

            // !list
            case 'LIST':
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
                                name: `\`${watch.watch_snooze ? '💤 ' : ''}${formatCapitalCase(watch.name)}\` | ${watch.price === -1 ? '' : ` \`${price}\` | `}\`${formatCapitalCase(watch.server)}\``,
                                value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
                                inline: false
                            })
                        })
                        message.author.send(
                            new Discord.MessageEmbed()
                            .setColor('#EFE357')
                            .setTitle(res.msg[0].global_snooze ? `__Active Watches (Snoozed)__`: `__Active Watches__`)
                            .addFields(watches)
                        )
                        .then((message) => {
                            message
                            .react('💤')                     // for "snooze (all)"
                            .then(() => message.react('♻'))  // for "extend (all)"
                            .then(() => {
                                const react_filter = (reaction, user) => {
                                    if (user.bot) {
                                        return;
                                    }
                                    return reaction.emoji.name === '💤' || reaction.emoji.name === '♻';
                                }
                                const collector = message.createReactionCollector(react_filter, { time: 1000 * 60 * 60 * 24 , dispose: true});
                                collector.on('collect', (reaction, user) => {
                                    if (user.bot) return;
                                    switch (reaction.emoji.name) {
                                        case '💤':
                                            // Snooze this watch for 6 hours
                                            db.snooze('user', user.id);
                                            user.send(`Sleep is good.  Pausing notifications for the next 6 hours on all watches.  Click 💤 again to unsnooze.  To snooze an individual watch, use \`!watches\` and react with the \`🔕\` emoji.`)
                                            .catch(console.error);
                                            break;
                                        case '♻': //extend watch
                                            db.extendAllWatches(user.id)
                                            user.send(`Good things come to those who wait.  I extended all your watches another 7 days.`);
                                            break;
                                        default:
                                            break;
                                    }
                                })
                                collector.on('remove', (reaction, user) => {
                                    if (user.bot) return;
                                    switch (reaction.emoji.name) {
                                        case '💤':
                                            // unsnooze all watches
                                            db.unsnooze('user', user.id);
                                            user.send(`Rise and grind.  Your account is no longer snoozed.`).catch(console.error);
                                            break;
                                        default:
                                            break;
                                    }
                                })
                            })
                        })
                        .catch(console.error);
                    }  else {
                        message.author.send("You don\'t have any watches.  Add some with `!watch`");
                    }
                });
                break;

            // !extend
            case 'EXTEND':
                message.author.send('All watches succesfully extended for another 7 days.');
                break;

            // !add block
            case 'BLOCK':
                if (args[1] === 'BLUE' || args[1] === 'GREEN') {
                    db.blockSeller(message.author.id, args[0], args[1], null)
                    message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${args[0]} on ${args[1]} for any current or future watches.`);
                } else {
                    db.blockSeller(message.author.id, args[0], null, null)
                    message.author.send(`Lets cut down the noise.  No longer notifying you about auctions from ${args[0]} on both servers for any current or future watches.  To only block this seller on one server, use \`\`!add block: ${args[0]}, server\`\``);
                }
                break;

            //TODO:
            case 'UNBLOCK':
                if (args[1] === 'BLUE' || args[1] === 'GREEN') {
                    db.unblockSeller(message.author.id, args[0], args[1], null)
                    message.author.send(`People change.  No longer blocking ${formatCapitalCase(args[0])} on ${formatCapitalCase(args[1])} server.`)
                } else {
                    db.unblockSeller(message.author.id, args[0], null, null)
                    message.author.send(`People change.  No longer blocking ${formatCapitalCase(args[0])} on either server.`)
                }
                break;

            //TODO:
            case 'BLOCKS':
                db.showBlocks(message.author.id, (res) => {
                    let blocks = [];
                    if (res.user_blocks.length === 0 && res.watch_blocks.length === 0) {
                        message.author.send(`You haven't blocked any sellers.  Use \`!block seller, server\` to block a seller on all watches, or react with the \`🔕\` emoji on a watch notification to block a seller only for a certain item.`)
                    } else {
                        if (res.user_blocks.length > 0) {
                            res.user_blocks.forEach(block => {
                                blocks.push({
                                    name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
                                    value: `All Watches`,
                                    inline: false
                                })
                            })
                            
                        } if (res.watch_blocks.length > 0) {
                            res.watch_blocks.forEach(block => {
                                blocks.push({
                                    name: `${formatCapitalCase(block.seller)} (${formatCapitalCase(block.server)})`,
                                    value: `\`${formatCapitalCase(block.name)}\` Watch`,
                                    inline: false
                                })
                            })
                        }  
                        message.author.send(
                            new Discord.MessageEmbed()
                            .setColor('#EFE357')
                            .setTitle(`__Blocks__`)
                            .addFields(blocks)
                        )
                        .catch(console.error);
                    }
                })
                break;
            case 'SNOOZE':
                //snooze all watches
                if (args && args[0]) {
                    db.snooze('USER', message.author.id, args[0]) 
                    message.author.send(`Sleep is good.  Pausing notifications on all watches for ${args[0]} hours.  Use \`\`!unsnooze\`\` to resume watch notifications.`)
                } else {
                    db.snooze('USER', message.author.id) 
                    message.author.send(`Sleep is good.  Pausing notifications on all watches for 6 hours.  Use \`\`!unsnooze\`\` to resume watch notifications.`)
                }
                break;
            case 'UNSNOOZE':
                //TODO: unsnooze all watches
                db.unsnooze('USER', message.author.id)
                message.author.send(`Rise and grind.  Let's get that Loaf of Bread`)
                break;
            // case 'GNOME FACT':
            //     //TODO: deliver gnome fact based on # provided or random if no number
            //     break;
            // case 'TIP':
            //     //TODO: deliver tip based on # provided or random if no number
            //     break;

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
    const historical_pricing = await fetchWikiPricing(item, server)

    const fields = []

    fields.push({
        name: formattedPrice || 'No Price Listed',
        value: `${formatCapitalCase(item)}`,
        inline: false
    })

    if (historical_pricing) {
        fields.push({
            name: `Historical Pricing Data`,
            value: historical_pricing,
            inline: false
        })
    }

    let msg = new Discord.MessageEmbed()
        .setColor(SERVER_COLOR[server])
        .setImage(url === `https://i.imgur.com/wXJsk7Y.png` ? null : url)
        .setTitle(`${formatCapitalCase(item)}`)
        .setAuthor('Watch Notification', url, `https://wiki.project1999.com/${formatItemNameForWiki(item)}`)
        .setDescription(`**${seller}** is currently selling **${formatCapitalCase(item)}** ${price ? 'for **' + price + 'pp**' : ''} on Project 1999 **${formatCapitalCase(server)}** server. \n\n\`\`${removeLogTimestamp(fullAuction)}\`\``)
        .addFields(fields)
        .setFooter(`To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo ignore auctions by this seller, click 🔕\nTo extend this watch, click ♻\nWatch expires ${moment(timestamp).add(7, 'days').fromNow()}`)
        .setTimestamp()
    if (bot.users.cache.get(user.toString()) === undefined) {
        bot.guilds.cache.get(GUILD).members.fetch(user.toString()).then((res)=>{res.send(msg)}).catch((err)=> {console.error(err)});
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
                    if (user.bot) return;
                    switch (reaction.emoji.name) {
                        case '💤': //alt: 🔕
                            // Snooze this watch for 6 hours
                            db.snooze('watch', watchId);
                            user.send(`Sleep is good.  Pausing notifications for the next 6 hours on your \`\`${item}\`\` watch on \`\`${server}\`\`.  Click 💤 again to unsnooze.  To snooze all watches, use \`\`!snooze\`\``).catch(console.error);
                            break;
                        case '❌':
                            // Delete this watch
                            db.endWatch(user.id, item, server);
                            user.send(`Got it! No longer watching auctions for ${item} on P1999 ${server} server.`);
                            break;
                        case '🔕':
                            // Ignore this seller's auctions for this watch
                            db.blockSeller(user.id, seller, null, watchId)
                            user.send(`Let's cut out the noise!  No longer notifying you about auctions from ${seller} with regard to this watch.\n  To block ${seller} on all present and future watches, use \`\`!add block: ${seller}`);
                            break;
                        case '♻': //extend watch
                            db.extendWatch(watchId)
                            user.send(`Good things come to those who wait.  I added another 7 days to your \`\`${formattedItem}\`\` watch.`);
                            break;
                        default:
                            break;
                    }
                })
                collector.on('remove', (reaction, user) => {
                    if (user.bot) return;
                    switch (reaction.emoji.name) {
                        case '💤':
                            // unsnooze watch
                            db.unsnooze('watch', watch.id);
                            user.send(`Rise and grind.  No longer snoozing on your \`\`${item}\`\` watch on \`\`${server}\`\`.`).catch(console.error);
                            break;
                        case '❌':
                            // renew this watch
                            // db.endWatch(user.id, item, server);
                            user.send(`Got it! No longer watching auctions for ${item} on P1999 ${server} server.`);
                            break;
                        case '🔕':
                            // unblock the seller for this auction
                            db.unblockSeller(user.id, seller, null, watchId)
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

    fetchAndFormatAuctionData(auction_user, auction_contents, server).then(formattedAuctionMessage => {
        bot.channels.fetch(channelID.toString())
            .then((channel) => {
                channel.send(formattedAuctionMessage)
            })
            .catch(console.error)
    });
}

bot.login(TOKEN);

module.exports = {pingUser, streamAuction}
