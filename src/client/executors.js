const db = require("../db/db.js");
const moment = require("moment");
const {
  watchBuilder,
  buildListResponse,
  blockBuilder,
  dedupeBlockResults,
} = require("./clientHelpers");
const { formatCapitalCase } = require("../utility/utils.js");

//	the purpose of this file is to do the heavy lifting of the command execution.
// 	this file combines discord and db commands

async function watch(interaction) {
  const args = interaction.options.data;
  if (args.length > 2 && args[2].value > 0) {
    return await db
      .addWatch(
        interaction.user.id,
        args[0].value,
        args[1].value,
        args[2].value
      )
      .then(async (res) => {
        const metadata = {
          id: res.id,
          itemSnooze: res.snoozed,
        };
        const embeds = await watchBuilder([
          {
            name: args[0].value,
            server: args[1].value,
            price: args[2].value,
            datetime: Date.now(),
          },
        ]).catch(console.error);
        return Promise.resolve({ embeds, metadata });
      })
      .catch((err) => {
        console.error(err);
        // TODO: log error
        return Promise.reject(err);
      });
  } else {
    // if no price, set watch accordingly
    return await db
      .addWatch(interaction.user.id, args[0].value, args[1].value)
      .then(async (res) => {
        const metadata = {
          id: res.id,
          itemSnooze: res.snoozed,
        };
        const embeds = await watchBuilder([
          {
            name: args[0].value,
            server: args[1].value,
            price: -1,
            datetime: Date.now(),
          },
        ]).catch(console.error);
        return Promise.resolve({ embeds, metadata });
      })
      .catch((err) => {
        console.error(err);
        return Promise.reject(err);
      });
  }
}

async function unwatch(interaction) {
  // does anything use this other than unwatch? careful because arguments are in a subcommand group
  const args = interaction.options.data[0].options;
  if (args.length > 1) {
    return await db.endWatch(interaction.user.id, args[0].value, args[1].value);
  }
  // end the watch
  return await db.endWatch(interaction.user.id, args[0].value);
}

async function unwatchAll(interaction) {
  return await db.endAllWatches(interaction.user.id).catch((err) => {
    return Promise.reject(err);
  });
}

async function watches(interaction) {
  const args = interaction.options.data;

  return await db
    .showWatch(
      interaction.user.id,
      args && args.length > 0 ? args[0].value : ""
    )
    .then(async (res) => {
      if (res.length > 0) {
        const embeds = await watchBuilder(res);
        return Promise.resolve({ embeds, metadata: res });
      } else {
        return Promise.resolve({ embeds: [] });
      }
    });
}

async function list(interaction) {
  return await db
    .listWatches(interaction.user.id)
    .then((res) => {
      if (!res || res.length < 1) {
        return Promise.resolve({ embeds: [] });
      }
      const embeds = buildListResponse(res);
      return Promise.resolve({
        // only pass thru relevant data
        embeds,
        metadata: { watch_id: res[0].id, globalSnooze: res[0].global_snooze },
      });
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

async function block(interaction) {
  const args = interaction.options.data;
  // if user specified a server, only block seller on that server
  if (args && args.length > 1) {
    return await db
      .blockSellerGlobally(interaction.user.id, args[0].value, args[1].value)
      .then((res) => {
        const embeds = blockBuilder([
          { seller: args[0].value, server: [args[1].value] },
        ]);
        const metadata = res.user_blocks[0];
        return Promise.resolve({
          content: `No longer notifying you about auctions from \`${
            args[0].value
          }\` on \`${formatCapitalCase(args[1].value)}\` Server.`,
          embeds,
          metadata,
        });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
  // otherwise, block seller on both servers
  else {
    return await db
      .blockSellerGlobally(interaction.user.id, args[0].value)
      .then((res) => {
        const embeds = blockBuilder([
          { seller: args[0].value, server: ["GREEN", "BLUE"] },
        ]);
        // TODO: handle this more elegantly that searching for blocks based on user/seller
        const metadata = res.user_blocks[0];
        return Promise.resolve({
          content: `No longer notifying you about auctions from \`${formatCapitalCase(
            args[0].value
          )}\` on either server.`,
          embeds,
          metadata,
        });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

async function unblock(interaction) {
  const args = interaction.options.data;
  // if user specified a server, only unblock seller on that server
  if (args && args.length > 1) {
    return await db
      .unblockSellerGlobally(interaction.user.id, args[0].value, args[1].value)
      .then((res) => {
        // no rows effected means they didn't have a block
        if (res.rowCount === 0) {
          return Promise.resolve({
            content: `You don't have any blocks for ${formatCapitalCase(
              args[0].value
            )} on ${formatCapitalCase(args[1].value)} server.`,
          });
        }
        return Promise.resolve({
          content: `People change.  No longer blocking ${formatCapitalCase(
            args[0].value
          )} on ${formatCapitalCase(args[1].value)} server.`,
        });
      });
  }
  // unblock on all servers
  return await db
    .unblockSellerGlobally(interaction.user.id, args[0].value)
    .then((res) => {
      if (res.rowCount === 0) {
        return Promise.resolve({
          content: `You don't have any blocks for ${formatCapitalCase(
            args[0].value
          )}.`,
        });
      }
      return Promise.resolve({
        content: `People change.  No longer blocking ${formatCapitalCase(
          args[0].value
        )} on either server.`,
      });
    });
}

async function blocks(interaction) {
  const args = interaction.options.data;
  let filter = null;
  if (args.length > 0) {
    filter = args[0].value;
  }
  // get blocks from db
  return await db.showBlocks(interaction.user.id, filter).then((res) => {
    if (res.user_blocks.length === 0 && res.watch_blocks.length === 0) {
      return {
        content:
          "You haven't blocked any sellers.  Use `!block seller, server` to block a seller on all watches, or react with the `🔕` emoji on a watch notification to block a seller only for a certain item.",
      };
    }
    const user_blocks = dedupeBlockResults(res.user_blocks);
    const embeds = blockBuilder(user_blocks.concat(res.watch_blocks));
    const metadata = user_blocks.concat(res.watch_blocks);
    return Promise.resolve({ embeds, metadata });
  });
}

async function snooze(interaction) {
  const command = interaction.options.getSubcommand();
  const item = interaction.options.getString("item");
  const hours = interaction.options.getString("hours") || 6;
  switch (command) {
    case "watches":
      // snooze all
      return await db
        .snooze("global", interaction.user.id)
        .then(async () => {
          return { content: "All your watches have been snoozed." };
        })
        .catch(async (err) => {
          Promise.reject(err);
        });
    case "watch":
      // snooze watch
      return await db
        .snoozeByItemName(interaction.user.id, item, hours)
        .then(async ({ results, metadata }) => {
          if (!results || results.length < 1) {
            return {
              content: `You don't have any watches for ${item}. Confirm watches with \`/list.\``,
            };
          }
          const embeds = await watchBuilder([results]);
          return {
            content: "Your `" + item + "` watch has been snoozed.",
            embeds,
            metadata,
          };
        })
        .catch((err) => {
          Promise.reject(err);
        });
    default:
      return;
  }
}

async function unsnooze(interaction) {
  const command = interaction.options.getSubcommand();
  const item = interaction.options.getString("item");
  const server = interaction.options.getString("server");

  // TODO: accept server argument
  switch (command) {
    case "watches":
      // unsnooze all
      return await db
        .unsnooze("GLOBAL", interaction.user.id)
        .then(() => {
          return Promise.resolve({
            content: "All watches unsnoozed - rise and grind!",
          });
        })
        .catch((err) => {
          Promise.reject(err);
        });
    case "watch":
      // snooze watch
      return await db
        .unsnoozeByItemName(interaction.user.id, item, server)
        .then(async ({ results, metadata }) => {
          // TODO: it's possible a user could have items on both servers - handle this edge case more gracefully
          if (!results || results.length < 1) {
            return Promise.resolve({
              content: `You don't have any watches for ${item}. Confirm watches with \`/list.\``,
            });
          }
          const embeds = await watchBuilder([results]);
          // TODO: inform user if their watch wasn't snoozed to begin with and still respond with watch embed
          return Promise.resolve({
            content: "Your `" + item + "` watch has been unsnoozed.",
            embeds,
            metadata,
          });
        })
        .catch((err) => {
          Promise.reject(err);
        });
    default:
      return;
  }
}

async function gnomeFact(interaction) {
  // TODO: return a random gnome fact to be called daily by bot
}

module.exports = {
  watch,
  unwatch,
  unwatchAll,
  watches,
  list,
  block,
  unblock,
  blocks,
  snooze,
  unsnooze,
  gnomeFact,
};
