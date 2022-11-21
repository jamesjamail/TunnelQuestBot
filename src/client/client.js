/* eslint-disable indent */
/* eslint-disable max-nested-callbacks */
const { Client, Intents, Collection } = require("discord.js");
const { Routes } = require("discord-api-types/v9");
const { REST } = require("@discordjs/rest");
const logger = require("winston");
const settings = require("../settings/settings.json");
const db = require("../db/db.js");
const fs = require("fs");
const path = require("path");
const commandDir = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandDir)
  .filter((file) => file.endsWith(".js") && !file.includes("example"));
const { fetchAndFormatAuctionData } = require("../utility/wikiHandler");
const {
  collectButtonInteractions,
  watchNotificationBuilder,
  buttonBuilder,
  gracefulSystemError,
  troubleshootingLinkEmbed,
} = require("./clientHelpers");
const { welcomeMsg } = require("../content/messages");
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true,
});
logger.level = "debug";

// Initialize Discord Client - this "partials" array below is required for Direct Messages to trigger messageCreate events.  Not documented much in discordjs docs.
const bot = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
  partials: ["CHANNEL"],
});
const TOKEN = settings.discord.token;
const GUILD = settings.discord.guild;
const COMMAND_CHANNEL = settings.discord.command_channel;
const GENERAL_CHANNEL = settings.discord.general_channel;
const BLUE_TRADING_CHANNEL = settings.servers.BLUE.trading_channel;
const GREEN_TRADING_CHANNEL = settings.servers.GREEN.trading_channel;

bot.on("ready", () => {
  logger.info(`Logged in as ${bot.user.tag}!`);
});

// Don't get burned by testing development with global commands!
//
// Global commands are cached for one hour. New global commands will fan out
// slowly across all guilds and will only be guaranteed to be updated after an
// hour. Guild commands update instantly. As such, we recommend you use guild-based
// commands during development and publish them to global commands when they're
// ready for public use.
bot.commands = new Collection();
const commands = [];
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
  bot.commands.set(command.data.name, command);
}

//TODO  create a separate file for registering guild commands, and only run it when neccesary manually

// When the client is ready, run this code (only once)
bot.once("ready", () => {
  console.log("Ready!");
  // There is a limit of 200 application command register calls per day
  // Only refresh commands if specified as an option
  if (process.argv.includes('--refresh-commands')) {
    const CLIENT_ID = bot.user.id;
    const rest = new REST({
      version: "9",
    }).setToken(TOKEN);
    (async () => {
      try {
        // clear guild commands regardless of env
        await rest
          .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD), {
            body: [],
          })
          .then(() => console.log("Successfully cleared guild command cache"))
          .catch((err) => gracefulSystemError(bot, err));
  
        // global commands have a delay before syncing - only use for production
        if (process.env.NODE_ENV.trim() === "production") {
          // clear command cache first to delete deprecated commands
          await rest
            .put(Routes.applicationCommands(CLIENT_ID), {
              body: [],
            })
            .then(() =>
              console.log("Successfully cleared application command cache")
            )
            .catch((err) => gracefulSystemError(bot, err));
  
          await rest
            .put(Routes.applicationCommands(CLIENT_ID), {
              body: commands,
            })
            .then(() =>
              console.log("Successfully registered application commands")
            )
            .catch((err) => gracefulSystemError(bot, err));
        } else {
          await rest
            .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD), {
              body: commands,
            })
            .then(() => console.log("Successfully registered guild commands"))
            .catch((err) => gracefulSystemError(bot, err));
        }
      } catch (error) {
        return gracefulSystemError(bot, error);
      }
    })();
  }
});

// command syntax is defined in /commands directory
bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    // errors from interactions are caught from within command files - this is a failsafe
    gracefulSystemError(bot, error);
    await interaction.reply({
      content:
        "Something went wrong...are you clicking on a message that hasn't been updated in the past 30 minutes?  If so, please trigger a fresh message by re-executing the command.",
      ephemeral: true,
    });
  }
});

bot.on("messageCreate", async (message) => {
  //	filter out auction spam from general chat
  if (!message.author.bot && message.channelId === GENERAL_CHANNEL) {
    const content = message.content.toUpperCase();
    if (
      content.includes("WTS") ||
      content.includes("WTB") ||
      content.includes("WTT")
    ) {
      await bot.users.cache
        .get(message.author.id)
        .send(
          `Hi <@${message.author.id}>, I'm trying to keep #general_chat free of auction listings.  Please use either <#${GREEN_TRADING_CHANNEL}> or <#${BLUE_TRADING_CHANNEL}>. Thanks!`
        )
        .catch(console.error);
      await message.delete().catch(async (err) => {
        return await gracefulSystemError(bot, err);
      });
    }
  }
  // inform user about slash commands if DM or public command space message
  else if (
    !message.author.bot &&
    (message.channelId === COMMAND_CHANNEL || message.channel.type === "DM") &&
    message.content.trim()[0] === "/" //if user tried a command as a message, give them an informative message
  ) {
    await message
      .reply({
        content:
          "You're so close! You entered a message, not a command. Please see the guide below for troubleshooting tips.",
        embeds: [troubleshootingLinkEmbed],
      })
      .then((reply) => {
        setTimeout(() => {
          reply.delete();
          message.delete();
        }, 10000);
      })
      .catch(async (err) => {
        return await gracefulSystemError(bot, err);
      });
  } else if (
    !message.author.bot &&
    (message.channelId === COMMAND_CHANNEL || message.channel.type === "DM")
  ) {
    await message
      .reply({
        content: "I respond to slash commmands.  Type `/` to get started.",
      })
      .then((reply) => {
        setTimeout(() => {
          reply.delete();
          message.delete();
        }, 10000);
      })
      .catch(async (err) => {
        return await gracefulSystemError(bot, err);
      });
  }
});

// server greeting for users who join
bot.on("guildMemberAdd", async (member) => {
  const memberTag = member.user.tag; // GuildMembers don't have a tag property, read property user of guildmember to get the user object from it
  await bot.users.cache
    .get(member.user.id)
    .send(`**Hi ${memberTag}!**\n\n` + welcomeMsg)
    .catch(async (err) => {
      return await gracefulSystemError(bot, err);
    });
});

async function pingUser(
  watchId,
  user,
  userId,
  seller,
  item,
  price,
  server,
  fullAuction,
  timestamp
) {
  // query db for communication history and blocked sellers - abort if not valid
  const validity = await db.validateWatchNotification(userId, watchId, seller);
  if (!validity) return;
  await db.postSuccessfulCommunication(watchId, seller);

  // 	watch notifications have different fields from watch results
  const embed = await watchNotificationBuilder({
    item,
    server,
    price,
    seller: seller || null,
    fullAuction,
    timestamp,
  });

  const directMessageChannel = await bot.users.createDM(user);
  const btnRow = buttonBuilder([
    { type: "watchNotificationSnooze" },
    { type: "watchNotificationUnwatch" },
    { type: "watchBlock" },
    { type: "watchNotificationWatchRefresh" },
  ]);
  directMessageChannel
    .send({ embeds: embed, components: [btnRow] })
    .then(async (message) => {
      // Sorry about this monstronsity...ideally there should be separate collectors for interactions and messages, however right now
      // its a monolith in clientHelpers.  All we need is the userId and id from the interaction, so let's just fake it for now
      const interaction = {
        id: message.id,
        user: {
          id: user,
        },
      };
      await collectButtonInteractions(
        interaction,
        { id: watchId, seller },
        message
      );
    });
  // don't catch so errors bubble up to command handlers
}

async function streamAuction(auction_user, auction_contents, server) {
  const channelId = settings.servers[server].stream_channel;
  const classicChannelId = settings.servers[server].stream_channel_classic;
  const rawAuction = `\`\`\`\n${auction_user} auctions, \'${auction_contents}\'\`\`\``;

  await fetchAndFormatAuctionData(auction_user, auction_contents, server)
    .then(async (formattedAuctionMessage) => {
      const streamChannel = await bot.channels.fetch(channelId);
      streamChannel.send({ embeds: [formattedAuctionMessage] });
      await bot.channels.fetch(channelId);
    })
    .catch(async (err) => {
      return await gracefulSystemError(bot, err);
    });

  await bot.channels
    .fetch(classicChannelId)
    .then(async (channel) => {
      await channel.send(rawAuction);
    })
    .catch(async (err) => {
      return await gracefulSystemError(bot, err);
    });
}

bot.login(TOKEN);

module.exports = { pingUser, streamAuction };
