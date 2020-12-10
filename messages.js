const settings = require('./settings.json');
const FEEDBACK_AND_IDEAS = settings.discord.feedback_and_ideas_channel;
const COMMAND_CHANNEL = settings.discord.command_channel;

const helpMsg = '\n\n' +
    '__***NOTE***__\n' +
    ' • All commands begin with an exclamation mark (\"!\").\n' +
    ' • Arguments listed in `code blocks` should be replaced with your input data.\n' +
    ' • Commas *are* actually required.\n' +
    ' • Nothing is case sensitive.\n' +
    ' • You may enter prices in pp or k (ex: 1100pp or 1.1k).\n' +
    ' • Parser will not detect aliases (ex: watching "Thick Banded Belt" will not detect "TBB"), however this is a future goal.\n' +
    '\n' +
    '__***COMMANDS***__\n' +
    '**!help**\n' +
    '> Displays available commands.\n\n' +
    '**!watch `item`, `server`, `maximum price`**\n' +
    '> Starts a watch based on entered parameters. Price is optional.\n\n' +
    '**!unwatch `item`, `server`**\n' +
    '> Ends a currently running watch.\n\n' +
    '**!unwatch all**\n' +
    '> Ends all currently running watches.\n\n' +
    '**!watches**\n' +
    '> Returns every watch as an individual message. An optional search term can be specified.  For example:\n `!watches belt of` returns all watches containing \"belt of\".\n\n' +
    '**!list**\n' +
    '> Lists details for all watches, account-wide blocks and snoozes in a concise message.\n\n' +
    '**!block `seller`, `server`**\n' +
    '>  Blocks a seller from triggering any watch notifications.  `server` is optional- if omitted the seller will be blocked on both servers.\n\n' +
    '**!unblock `seller`, `server`**\n' +
    '> Unblocks a seller for all watch notifications.  `server` is optional- if omitted the seller will be unblocked on both servers.\n\n' +
    '**!snooze `hours`**\n' +
    '> Pauses notifications on all watches.  \`hours\` is optional; if omitted, watches are snoozed for 6 hours.\n\n' +
    '**!unsnooze**\n' +
    '> Resumes notifications on all watches.\n\n' +
    '__***TIPS***__\n' +
    ' • You can use `!watch` to update an existing watch if you wish to modify the price requirement.\n' +
    ' • Watch notifications and results from the \`!watches\` command have emoji reactions that trigger useful commands.\n' +
    ' • To report a problem or request a feature, talk to us in ' + `<#${FEEDBACK_AND_IDEAS}>`;


const welcomeMsg = 'I am TunnelQuestBot, your helpful gnome assistant. Please allow me to make buying and selling items easier so you can finally start tipping for ports.\n\n' +
    'I watch EC auctions on both Blue and Green servers. If you\'re in the market for a new sword, you can enter the following command as a direct message to me, or in ' + `<#${COMMAND_CHANNEL}>:\n\n` +
    '\`!watch rusty bastard sword, green\`\n\n' +
    'If you only have 5pp to spend, you can enter a price criteria:\n\n' +
    '\`!watch rusty bastard sword, green, 5pp\`\n\n' +
    'Whenever I find a match, I\'ll send you a direct message with all the pertinent info.\n\n' +
    'Watches last 7 days before they expire, and can be renewed at any time.\n\n' +
    'Most of the commands needed interact with watches are available through emoji reactions.\n\n\n' +
    'You can also check out our Tunnel Stream channels.\n\n' +
    'Auction message are displayed at the top of each post with links to the wiki items beneath.  Hovering over the item name displays historical pricing data courtesy of the P1999 wiki.\n\n\n' +
    'For more information, try the \`!help\` command.\n\n\n' +
    '**Welcome to the server!**';

module.exports = { helpMsg, welcomeMsg };