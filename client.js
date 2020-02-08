const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json');
const helpMsg = '\n\n***TunnelQuestBot Help***\n***NOTE:***\n-All commands begin with an exclamation mark (\"!\").\n-Arguments listed in carats (\"<\" \">\") should be replaced by your input data.\n\n***COMMANDS***\n!help   (displays available commands)\n!add watch: <item>, <min price>, <server>   (starts a watch based on enetered parameters - wathces expire after 7 days)\n!end watch: <item>   (ends a currently running watch)\n!show watch: <item>   (lists details for a watch for entered item - if no item is provided, lists details for all watches)\n!show watches   (lists details for all watches)'
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
    console.log(user, ":", message);
    
    // listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.toUpperCase().substring(1).split(/,|:/);
        var cmd = args[0];
        args = args.splice(1);
        args.forEach((elem, index, array) => array[index] = elem.trim());
        switch(cmd) {
            // !help
            case 'HELP':
                bot.sendMessage({
                    to: channelID,
                    message: 'Thanks for using TunnelQuestBot! ' + helpMsg
                });
                break;

            // !add watch <item>
            case 'ADD WATCH':
                console.log('add watch command received.  args = ', args)
                db.addWatch(userID, args[0], args[1], args[2]);
                msgUser(userID, `Got it! Now watching auctions for ${args[0]} at ${args[1]}pp or less on P1999 ${args[2]} server.`)
                break;

            // !end watch: <item>, <server>
            case 'END WATCH':
                console.log('end watch command received.  args = ', args)
                db.endWatch(userID, args[0], args[1]);
                break;
                
            // !show watch: <item>
            case 'SHOW WATCH':
                console.log('show watch command received.  args = ', args)
                if (args[0] === "" || args[0] === undefined) {
                    db.showWatches(userID, (res) => {
                        console.log("CLIENT SIDE RES =  ", res)
                        if (res.success) {
                            msgUser(userID, 'Here are your watches: \n' + res.msg);
                        }  else {
                            msgUser(userID, `You don\'t have any watches.`);
                        }

                        
                    });
                } else {
                    db.showWatch(userID, args[0], (res) => {
                        console.log("CLIENT SIDE RES =  ", res)
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

            //default: command not recognized...
            default: 
                bot.sendMessage({
                    to: channelID,
                    message: 'Sorry, I didn\'t recognized that command.  Please check your syntax and try again. ' + helpMsg
                });
            break;
         }
    }
    else if (!userID === 643497793834582017n || channelID === 673793154729771028n) {
        bot.sendMessage({
            to: channelID,
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
    bot.sendMessage({
        to: user,
        message: `${seller} is currently selling ${item} for ${price}pp on Project 1999 ${server} server. \n***${fullAuction}***\n To stop these messages, type \"!end watch: ${item}, ${server}\".`
    })
};

function streamAuction (msg, server) {
    let channelID;

    if (server === "GREEN") {
        channelID = 672512233435168784n;
    }
    bot.sendMessage({
        to: channelID,
        message: msg
    })
};

module.exports = {pingUser, msgUser, streamAuction}
