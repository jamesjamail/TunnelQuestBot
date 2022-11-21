const { Routes } = require("discord-api-types/v9");
const { REST } = require("@discordjs/rest");
const {
    gracefulSystemError,
  } = require("./clientHelpers");


async function registerCommands(bot, token, guild, commands) {
    const CLIENT_ID = bot.user.id;
    const rest = new REST({
      version: "9",
    }).setToken(token);
    return (async () => {
        // clear guild commands regardless of env
        await rest
          .put(Routes.applicationGuildCommands(CLIENT_ID, guild), {
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
            .put(Routes.applicationGuildCommands(CLIENT_ID, guild), {
              body: commands,
            })
            .then(() => console.log("Successfully registered guild commands"))
            .catch((err) => gracefulSystemError(bot, err));
        }
    })();
}

module.exports = { registerCommands };