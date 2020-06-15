const helpMsg = '\n\n' +
    '**TunnelQuestBot Help**\n' +
    '***NOTE:***\n' +
    ' • All commands begin with an exclamation mark (\"!\").\n' +
    ' • Arguments listed in `code blocks` should be replaced with your input data.\n' +
    ' • Commas *are* actually required.\n' +
    ' • Item names are not case sensitive.\n' +
    ' • You may enter prices in pp or k (ex: 1100pp or 1.1k).\n' +
    ' • Parser will not detect aliases (ex: watching "Thick Banded Belt" will not detect "TBB"), however this is a future goal.\n' +
    '\n' +
    '***COMMANDS:***\n' +
    '!help\n' +
    '> Displays available commands.\n' +
    '!add watch: `item`, `maximum price`, `server`\n' +
    '> Starts a watch based on entered parameters - watches expire after 7 days.  Price is optional.\n' +
    '!end watch: `item`, `server`\n' +
    '> Ends a currently running watch.\n' +
    '!end all watches' +
    '> Ends all currently running watches.\n' +
    '!extend all watches\n' +
    '> Extends your current watches another 7 days.\n' +
    '!show watch: `item`, `server`\n' +
    '> Lists details for a watch for entered item - if no arguments are provided, behaves as *!show watches*.\n' +
    '!show watches\n' +
    '> Lists details for all watches.\n' +
    '\n' +
    '***TIPS:***\n' +
    ' • You can use `!add watch` to update an existing watch if you wish to modify the price and/or reset the 7 day expiration timer.\n' +
    ' • To report a problem or request a feature, talk to us in #feedback_and_ideas, or create an issue here: https://github.com/jamesjamail'


const welcomeMsg = 'I am TunnelQuestBot, your helpful gnome assistant. Please allow me to make buying and selling items easier so you can finally start tipping for ports.\n\n' +
    'I watch EC auctions on both Blue and Green servers. If you\'re in the market for a new sword, you can enter the following command as a direct message to me, or in the \`public_command_space channel\`:\n\n' +
    '\`!add watch: rusty bastard sword, green\`\n\n' +
    'If you only have 5pp to spend, you can enter a price criteria:\n\n' +
    '\`!add watch: rusty bastard sword, 5pp, green\`\n\n' + 
    'Whenever I find a match, I\'ll send you a direct message with all the pertinent info.\n\n' +
    'Watches last 7 days before they expire.\n\n\n' +
    'You can also check out our Tunnel Stream channels.\n\n' +
    'Auction message are displayed at the top of each post with links to the wiki items beneath.  Hovering over the item name displays historical pricing data courtesy of the P1999 wiki.\n\n\n' +
    'For more information, try the !help command.\n\n\n' +
    '**Welcome to the server!**'

module.exports = { helpMsg, welcomeMsg }