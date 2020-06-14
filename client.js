const Discord = require('discord.js');
const logger = require('winston');
const settings = require('./settings.json');
const helpMsg = '\n\n***TunnelQuestBot Help***\n***NOTE:***\n-All commands begin with an exclamation mark (\"!\").\n-Arguments listed in carats (\"<\" \">\") should be replaced by your input data.\n-Item names are not case sensitive.\n-You may enter prices in pp or kpp (ex: 1100pp or 1.1k).\n-Parser will not detect aliases (ex: watching "Thick Banded Belt" will not detect "TBB"), however this is a future goal.\n\n***COMMANDS***\n!help   (displays available commands)\n!add watch: <item>, <at or below this price>, <server>   (starts a watch based on enetered parameters - watches expire after 7 days.  Price is optional)\n!end watch: <item>   (ends a currently running watch)\n!end all watches   (ends all currently running watches)\n!extend all watches   (extends your current watches another 7 days)\n!show watch: <item>   (lists details for a watch for entered item - if no item is provided, lists details for all watches)\n!show watches   (lists details for all watches)\n\n ***TIPS***\n-You use !add watch to update an existing watch if you wish to modify the price and/or reset the 7 day expiration timer'
const db = require('./db.js');
const {fetchAndFormatAuctionData} = require("./wikiHandler");

// logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Client
var bot = new Discord.Client();
const TOKEN = settings.discord.token;
const COMMAND_CHANNEL = settings.discord.command_channel;

bot.on('ready', () => {
    logger.info(`Logged in as ${bot.user.tag}!`);
});

bot.on('message', function (message) {
    // console.log(message);
    // ignore bots or messages from any text channel that isn't the Command Channel
    if (message.author.bot || (message.channel.type === 'text' && message.channel.id !== COMMAND_CHANNEL)){
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
                    message.author.send(`Got it! Now watching auctions for ${args[0]} at any price on P1999 ${args[1]} server.`)
                    args[2] = args[1];
                    args[1] = -1;
                    db.addWatch(message.author.id, args[0], args[1], args[2]);
                } 
                else if (args[2] !== undefined && args[2].toUpperCase() !== 'GREEN' && args[2].toUpperCase() !== 'BLUE') {
                    message.author.send(`Sorry, I don't recognize the server name ${args[2]}.  Please try "green" or "blue"`);
                } else {
                    db.addWatch(message.author.id, args[0], args[1], args[2]);
                    message.author.send(`Got it! Now watching auctions for ${args[0]} at ${args[1]}pp or less on P1999 ${args[2]} server.`)
                }
                break;

                // !end watch: <item>, <server>
                case 'END WATCH':
                    // console.log('end watch command received.  args = ', args)
                    if (args === undefined || args[0] === undefined || args[1] === undefined) {
                        message.author.send('Please specify both item and server to end a watch, or use "!end all watches" to end all watches.')
                    } else {
                        db.endWatch(message.author.id, args[0], args[1]);
                    }
                    break;
                    
                 // !show watch: <item>
                case 'SHOW WATCH':
                    // console.log('show watch command received.  args = ', args)
                    if (args === undefined || args[0] === "") {
                        db.showWatches(message.author.id, (res) => {
                            if (res.success) {
                                message.author.send('Here are your watches: \n' + res.msg);
                            }  else {
                                message.author.send(`You don\'t have any watches.`);
                            }  
                        });
                    } else {
                        db.showWatch(message.author.id, args[0], (res) => {
                            if (res.success) {
                                message.author.send('Here is your watch: \n' + res.msg);
                            }  else {
                                message.author.send(`You don\'t have any watches for ${args[0]}.`);
                            }
                        });
                    }
                    break;

                    // !show watches
                    case 'SHOW WATCHES':
                        // console.log('show watches command received.  args = ', args)
                        db.showWatches(message.author.id, (res) => {
                            if (res.success) {
                                message.author.send('Here are your watches: \n' + res.msg);
                            }  else {
                                message.author.send(`You don\'t have any watches.`);
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

                    // default: command not recognized...
                    default: 
                        message.author.send('Sorry, I didn\'t recognized that command.  Please check your syntax and try again. ' + helpMsg);
                        break;
        }
    }
    else {
        message.author.send('I\'d love to chat, but I\'m just a dumb bot.  Try !help');
    }   
})

function pingUser (userID, seller, item, price, server, fullAuction) {
    let msg = '';

    if (price === null) {
        msg = `${seller} is currently selling ${item} on Project 1999 ${server} server.  I was unable to determine the price. \n***${fullAuction}***\n To stop these messages, type \"!end watch: ${item}, ${server}\".`
    } else {
        msg  = `${seller} is currently selling ${item} for ${price}pp on Project 1999 ${server} server. \n***${fullAuction}***\n To stop these messages, type \"!end watch: ${item}, ${server}\".`    
    }
    
    if (bot.users.cache.get(userID.toString()) === undefined) {
        console.log('sending msg to user ', userID)
        bot.guilds.cache.get("643500242846744611").members.fetch(userID.toString()).then((res)=>{res.send(msg)}).catch((err)=> {console.log(err)});
    } else {
        bot.users.cache.get(userID.toString()).send(msg).catch((err)=> console.log('ping user else block', userID, err));
    }
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
