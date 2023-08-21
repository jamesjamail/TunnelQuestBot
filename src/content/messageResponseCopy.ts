const COMMAND_CHANNEL = process.env.command_channel;
const FEEDBACK_AND_IDEAS = process.env.feedback_and_ideas_channel;

export const helpMsg =
  "\n\n" +
  "__***HELP***__\n" +
  " • TunnelQuestBot uses Discord Slash Commands.  Type `/` in" +
  `<#${COMMAND_CHANNEL}>` +
  " to get started.\n" +
  "\n" +
  "__***COMMANDS***__\n" +
  "**/help**\n" +
  "> Displays available commands.\n\n" +
  "**/watch `item` `server` `maximum price`**\n" +
  "> Starts a watch based on entered parameters. Maximum price is optional.\n\n" +
  "**/unwatch item `item` `server`**\n" +
  "> Ends a currently running watch. Server is optional.\n\n" +
  "**/unwatch all watches**\n" +
  "> Ends all currently running watches.\n\n" +
  "**/watches `search filter`**\n" +
  '> Returns every watch as an individual message. An optional search term can be specified.  For example: `/watches belt of` returns all watches containing "belt of".\n\n' +
  "**/list**\n" +
  "> Lists details for all watches in a concise message.\n\n" +
  "**/block `seller` `server`**\n" +
  ">  Blocks a seller from triggering any watch notifications.  `server` is optional; if omitted, the seller will be blocked on both servers.\n\n" +
  "**/blocks `search filter`**\n" +
  "> Returns every block as an individual message. An optional search term can be specified for the player name.\n\n" +
  "**/unblock `seller` `server`**\n" +
  "> Unblocks a seller for all watch notifications.  `server` is optional- if omitted the seller will be unblocked on both servers.\n\n" +
  "**/snooze watch `item` `hours`**\n" +
  "> Pauses notifications on a specific watch.  `hours` is optional; if omitted, watch is snoozed for 6 hours.\n\n" +
  "**/snooze all watches `hours`**\n" +
  "> Pauses notifications on all watches.  `hours` is optional; if omitted, watches are snoozed for 6 hours.\n\n" +
  "**/unsnooze `watch`**\n" +
  "> Unsnooze a specific watch.\n\n" +
  "**/unsnooze all watches**\n" +
  "> Unsnooze all watches.\n\n" +
  "__***TIPS***__\n" +
  " • You can use `/watch` to update an existing watch if you wish to modify the price requirement.\n" +
  " • Most responses have buttons that trigger useful commands.\n" +
  " • To report a problem or request a feature, talk to us in " +
  `<#${FEEDBACK_AND_IDEAS}>`;

export const welcomeMsg =
  "Hello! I am TunnelQuestBot, your helpful gnome assistant. Please allow me to make buying and selling items easier so you can finally start tipping for ports.\n\n" +
  "I watch EC auctions on both Blue and Green servers. If you're in the market for a new sword, you can set up a watch with the `/watch` command.\n\n" +
  "Commands can be entered in" +
  `<#${COMMAND_CHANNEL}>:\n\n` +
  "or as a Direct Message to me.\n\n" +
  "Let's say you're in the market for a weapon upgrade.\n\n" +
  "`/watch` `rusty bastard sword` `green server`\n\n" +
  "If you only have 5pp to spend, you can enter a price criteria:\n\n" +
  "`/watch` `rusty bastard sword` `green server` `5`\n\n" +
  "Whenever I find a match, I'll send you a direct message with all the pertinent info.\n\n" +
  "Watches last 7 days before they expire, and can be renewed at any time.\n\n" +
  "Most responses feature buttons which trigger useful commands.\n\n\n" +
  "You can also check out our Tunnel Stream channels.\n\n" +
  "Auction message are displayed at the top of each post with links to the wiki items beneath.  Hovering over the item name displays historical pricing data courtesy of the P1999 wiki.\n\n\n" +
  "For more information, try the `/help` command.\n\n\n" +
  "**Welcome to the server!**";