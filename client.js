const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json');
const helpMsg = '\n\n***TunnelQuestBot Help***\n***NOTE:***\n-All commands begin with an exclamation mark (\"!\").\n-Arguments listed in carats (\"<\" \">\") should be replaced by your input data.\n-Item names are not case sensitive.\n-You may enter prices in pp or kpp (ex: 1100pp or 1.1k).\n-Parser will not detect aliases (ex: watching "Thick Banded Belt" will not detect "TBB"), however this is a future goal.\n\n***COMMANDS***\n!help   (displays available commands)\n!add watch: <item>, <at or below this price>, <server>   (starts a watch based on enetered parameters - watches expire after 7 days.  Price is optional)\n!end watch: <item>   (ends a currently running watch)\n!end all watches   (ends all currently running watches)\n!extend all watches   (extends your current watches another 7 days)\n!show watch: <item>   (lists details for a watch for entered item - if no item is provided, lists details for all watches)\n!show watches   (lists details for all watches)\n\n ***TIPS***\n-You use !add watch to update an existing watch if you wish to modify the price and/or reset the 7 day expiration timer'
const db = require('./db.js');

// logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Client
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', function (user, userID, channelID, message, evt) {
    console.log(user, userID, channelID, message)
    if (userID !== '643497793834582017' && channelID !== '673793154729771028') {
        console.log(user, ":", message);
    }
    
    // listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        let colIndex = message.indexOf(':');
        let cmd;
        let args;
        if (colIndex === -1) {
            cmd = message.substring(1).toUpperCase().trim();
        } else {
            cmd = message.substring(1, colIndex).toUpperCase();
            args = message.substring(colIndex+1).toUpperCase().split(',');
            args.forEach((elem, index, array) => array[index] = elem.trim().replace(/[<>"\{\}\[\]]/g, ''));
        }

        switch(cmd) {
            // !help
            case 'HELP':
                bot.sendMessage({
                    to: userID,
                    message: 'Thanks for using TunnelQuestBot! ' + helpMsg
                });
                break;

            // !add watch <item>
            case 'ADD WATCH':
                console.log('add watch command received.  args = ', args)
                if (args[0] === undefined || args[1] === undefined) {
                    msgUser(userID, `Sorry, it looks like your missing some arguments.  Please specify ITEM, PRICE, SERVER in that order separated by commas.  Try "!help" for syntax structure.`)
                } else if (args[2] === undefined && args[1].toUpperCase().includes('GREEN') || args[2] === undefined && args[1].toUpperCase().includes('BLUE')) {
                    msgUser(userID, `Got it! Now watching auctions for ${args[0]} at any price on P1999 ${args[1]} server.`)
                    args[2] = args[1];
                    args[1] = -1;
                    db.addWatch(userID, args[0], args[1], args[2]);
                }
                else if (args[2] !== undefined && args[2] !== undefined && args[2].toUpperCase() === 'BLUE') {
                    msgUser(userID, `Sorry, due to IP Restrictions TunnelQuest is currently only watching P1999 Green Server.`)
                }  
                else if (args[2] !== undefined && args[2].toUpperCase() !== 'GREEN') {
                    msgUser(userID, `Sorry, I don't recognize the server name ${args[2]}.  Please try "green" or "blue"`);
                } else {
                    db.addWatch(userID, args[0], args[1], args[2]);
                    msgUser(userID, `Got it! Now watching auctions for ${args[0]} at ${args[1]}pp or less on P1999 ${args[2]} server.`)
                }
                break;

            // !end watch: <item>, <server>
            case 'END WATCH':
                console.log('end watch command received.  args = ', args)
                if (args === undefined || args[0] === undefined || args[1] === undefined) {
                    msgUser(userID, 'Please specify both item and server to end a watch, or use "!end all watches" to end all watches.')
                } else {
                    db.endWatch(userID, args[0], args[1]);
                }
                break;
                
            // !show watch: <item>
            case 'SHOW WATCH':
                console.log('show watch command received.  args = ', args)
                if (args === undefined || args[0] === "") {
                    db.showWatches(userID, (res) => {
                        if (res.success) {
                            msgUser(userID, 'Here are your watches: \n' + res.msg);
                        }  else {
                            msgUser(userID, `You don\'t have any watches.`);
                        }

                        
                    });
                } else {
                    db.showWatch(userID, args[0], (res) => {
                        if (res.success) {
                            msgUser(userID, 'Here is your watch: \n' + res.msg);
                        }  else {
                            msgUser(userID, `You don\'t have any watches for ${args[0]}.`);
                        }
                    });
                }
                break;

            // !show watches
            case 'SHOW WATCHES':
                console.log('show watches command received.  args = ', args)
                db.showWatches(userID, (res) => {
                    if (res.success) {
                        msgUser(userID, 'Here are your watches: \n' + res.msg);
                    }  else {
                        msgUser(userID, `You don\'t have any watches.`);
                    }
                });
                break;

            case 'END ALL WATCHES':
                console.log('end all watches command received.  args = ', args)
                db.endAllWatches(userID);
                msgUser(userID, 'All watches succesfully ended.');
                break;

            case 'EXTEND ALL WATCHES':
                console.log('extend all watches command received.  args = ', args)
                db.extendAllWatches(userID);
                msgUser(userID, 'All watches succesfully extended for another 7 days.');
                break;

            //default: command not recognized...
            default: 
                bot.sendMessage({
                    to: userID,
                    message: 'Sorry, I didn\'t recognized that command.  Please check your syntax and try again. ' + helpMsg
                });
            break;
         }
    }
    else if (user !== 'TunnelQuestBot' && channelID !== '673793154729771028' && channelID !== '675891646235279386' && channelID !== '673793154729771028' && channelID !== '673791839492505621') {
        console.log(typeof channelID)
        bot.sendMessage({
            to: userID,
            message: 'I\'d love to chat, but I\'m just a dumb bot.  Try !help'
        });
    }     
});

function msgUser(userID, msg) {
    bot.sendMessage({
        to: userID,
        message: msg
    })
}

function pingUser (user, seller, item, price, server, fullAuction) {
    if (price === null) {
        bot.sendMessage({
            to: user,
            message: `${seller} is currently selling ${item} on Project 1999 ${server} server.  I was unable to determine the price. \n***${fullAuction}***\n To stop these messages, type \"!end watch: ${item}, ${server}\".`
        })
    } else {
        bot.sendMessage({
            to: user,
            message: `${seller} is currently selling ${item} for ${price}pp on Project 1999 ${server} server. \n***${fullAuction}***\n To stop these messages, type \"!end watch: ${item}, ${server}\".`
        })
    }
};

function streamAuction (msg, server) {
    let channelID;

    if (server === "GREEN") {
        channelID = "672512233435168784";
    }
    bot.sendMessage({
        to: channelID,
        message: msg
    })
};

module.exports = {pingUser, msgUser, streamAuction}
