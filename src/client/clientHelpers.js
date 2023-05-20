/* eslint-disable indent */
const db = require("../db/db.js");
const { ActionRowBuilder, MessageButton, EmbedBuilder } = require("discord.js");
const {
  formatCapitalCase,
  removeLogTimestamp,
} = require("../utility/utils.js");
const {
  fetchImageUrl,
  fetchWikiPricing,
} = require("../utility/wikiHandler.js").default;
const moment = require("moment");
// const sslRootCAs = require("ssl-root-cas");
// sslRootCAs
//   .inject()
//   .addFile(
//     __dirname +
//       "../../../Certificates/SectigoRSADomainValidationSecureServerCA.crt"
//   );
const wiki_url = require("../utility/data/items.json");
const Discord = require("discord.js");
const SERVER_COLOR = { BLUE: "#1C58B8", GREEN: "#249458", BOTH: "#000" };
const settings = require("../settings/settings.json");

const MessageType = {
  0: "WATCH",
  1: "LIST",
  2: "NOTIFICATION",
};

// TODO: cases for each button id should be handled in separate files (cleanup)
async function collectButtonInteractions(interaction, metadata, message) {
  // because watch notifications aren't triggered by command, they lack an interaction.  a message is supplied instead.
  // interactions need to fetch the message to scope the collector to the message the buttons are attached to.
  const reply = message
    ? message
    : await interaction.fetchReply().catch(console.error);
  // !!! READ THIS BEFORE CHANGING THE COLLECTOR !!!
  //
  // Do not follow the discordjs guide on collectors, which recommend adding a collector to the entire channel.
  // This will cause unexpected duplicate events when the same command is used more than once, and generally causes
  // chaos using interactions in guild channels and DMs simultaneously.  Keep the collector scoped to the message
  // the buttons are attached to ensure button events are handled correctly (and reduce load on the collector)
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30 * 60000,
  });
  collector.on("collect", async (i) => {
      await gracefulSystemError(`Button Interation Collected ${i.customId} from user ${i.user.id}`);
    // TODO: I don't think this is required anymore now that the collector is scoped to the message it's on- cleaner to have a filter as a function
    //
    // https://discordjs.guide/popular-topics/collectors.html#interaction-collectors
    // "One important difference to note with interaction collectors is that Discord expects a response to all interactions within 3 seconds -
    // even ones that you don't want to collect. For this reason, you may wish to .deferUpdate() all interactions in your filter, or not use
    // a filter at all and handle this behavior in the collect event."
    if (!i.user.bot && i.user.id === interaction.user.id) {
      switch (i.customId) {
        case "globalRefresh":
          return await db
            .extendAllWatches(interaction.user.id)
            .then(async (res) => {
              const updatedMsg = buildListResponse(res);
              const btnRow = buttonBuilder([
                { type: "globalSnooze", active: res[0].global_snooze },
                { type: "globalRefresh", active: true },
              ]);
              return await i.update({
                content: "All watches extended another 7 days!",
                embeds: updatedMsg,
                components: [btnRow],
              });
            })
            .catch(async (err) => {
              return await gracefulError(i, err);
            });
        case "globalSnooze":
          // use listWatches to check global_snooze state (state may have changed since issuing command)
          return await db.listWatches(interaction.user.id).then(async (res) => {
            // TODO: handle no watch edge case
            if (res && res.length > 0 && res[0]["global_snooze"]) {
              // unsnooze if already snoozed
              return await db
                .unsnooze("global", interaction.user.id)
                .then(async (res) => {
                  const updatedMsg = buildListResponse(res);
                  const btnRow = buttonBuilder([
                    { type: "globalSnooze" },
                    { type: "globalRefresh" },
                  ]);
                  return await i.update({
                    content: "All watches unsnoozed.",
                    embeds: updatedMsg,
                    components: [btnRow],
                  });
                })
                .catch(async (err) => {
                  return await gracefulError(i, err);
                });
            }
            return await db
              .snooze("global", interaction.user.id)
              .then(async (res) => {
                const updatedMsg = buildListResponse(res);
                const btnRow = buttonBuilder([
                  { type: "globalSnooze", active: true },
                  { type: "globalRefresh" },
                ]);
                return await i.update({
                  content: "All watches snoozed for 6 hours.",
                  embeds: updatedMsg,
                  components: [btnRow],
                });
              })
              .catch(async (err) => {
                return await gracefulError(i, err);
              });
          });

        case "itemSnooze":
          return await db.showWatchById(metadata.id).then(async (watch) => {
            // if already snoozed, unsnooze
            if (watch.snoozed) {
              // careful, snoozed vs itemSnooze is ambiguously used
              return await db
                .unsnooze("item", metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
                .then(async (res) => {
                  const updatedMsg = await watchBuilder([res]);
                  const buttonConfig = [
                    { type: "itemSnooze", active: watch.itemSnooze },
                    { type: "unwatch" },
                    { type: "itemRefresh" },
                  ];

                  const btnRow = buttonBuilder(buttonConfig);
                  return await i.update({
                    content: "All watches snoozed for 6 hours.",
                    embeds: updatedMsg,
                    components: [btnRow],
                  });
                })
                .catch(async (err) => {
                  return await gracefulError(i, err);
                });
            }
            // if not already snoozed, snooze
            return await db
              .snooze("item", metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
              .then(async (res) => {
                const updatedMsg = await watchBuilder([res]);
                const buttonConfig = [
                  { type: "itemSnooze", active: true },
                  { type: "unwatch" },
                  { type: "itemRefresh" },
                ];

                const btnRow = buttonBuilder(buttonConfig);
                return await i.update({
                  content: "All watches snoozed for 6 hours.",
                  embeds: updatedMsg,
                  components: [btnRow],
                });
              })
              .catch(async (err) => {
                return await gracefulError(i, err);
              });
          });
        case "itemRefresh":
          return await db
            .extendWatch(metadata.id)
            .then(async (res) => {
              const updatedMsg = await watchBuilder([res]);
              const btnRow = buttonBuilder([
                { type: "itemSnooze", active: res.snoozed },
                { type: "unwatch", active: !res.active },
                { type: "itemRefresh" },
              ]);
              return await i.update({
                content: "This watch has been extended another 7 days!",
                embeds: updatedMsg,
                components: [btnRow],
              });
            })
            .catch(async (err) => {
              return await gracefulError(i, err);
            });
        case "unwatch":
          // first get status to determine if unwatching or undoing an unwatch button command
          return await db.showWatchById(metadata.id).then(async (watch) => {
            // if watch is active, unwatch it
            if (watch.active) {
              return await db
                .endWatch(null, null, null, metadata.id)
                .then(async (res) => {
                  const updatedMsg = await watchBuilder([res]);
                  const btnRow = buttonBuilder([
                    { type: "itemSnooze", active: res.snoozed },
                    { type: "unwatch", active: !res.active },
                    { type: "itemRefresh" },
                  ]);
                  // snoozing an inactive watch is a confusing user experience, so let's disable the button
                  btnRow.components[0].setDisabled(true);
                  return await i.update({
                    content: "This watch has been removed.",
                    embeds: updatedMsg,
                    components: [btnRow],
                  });
                })
                .catch(async (err) => {
                  return await gracefulError(i, err);
                });
            }
            // otherwise watch is inactive, meaning a user is undoing a previous unwatch cmd
            return await db
              .extendWatch(metadata.id)
              .then(async (res) => {
                const updatedMsg = await watchBuilder([res]);
                const btnRow = buttonBuilder([
                  { type: "itemSnooze", active: res.snoozed },
                  { type: "unwatch", active: !res.active },
                  { type: "itemRefresh" },
                ]);
                return await i.update({
                  content: "This watch has been extended another 7 days!",
                  embeds: updatedMsg,
                  components: [btnRow],
                });
              })
              .catch(async (err) => {
                return await gracefulError(i, err);
              });
          });
        case "globalUnblock":
          // for watches we give the users the ability to undo an unwatch button press.
          // this is useful for misclicks
          // however because /blocks is used so rarely, and the fact that we don't have an active
          // column in the table like we do for watches, let's just delete the message.
          return await db
            .unblockSellerGlobally(interaction.user.id, metadata.seller)
            .then(async () => {
              return await i.update({
                content: `The block on \`${metadata.seller}\` has been removed.`,
                embeds: [],
                components: [],
              });
            })
            .catch(async (err) => {
              return await gracefulError(i, err);
            });
        case "watchUnblock":
          return await db
            .unblockSellerByWatchId(metadata.watch_id, metadata.seller)
            .then(async () => {
              return await i.update({
                content: `The block on \`${metadata.seller}\` for this watch has been removed.`,
                embeds: [],
                components: [],
              });
            })
            .catch(async (err) => {
              return await gracefulError(i, err);
            });
        case "watchBlock":
          // TODO: separate interaction and message collectors
          return await db
            .showBlocks(interaction.user.id, metadata.seller)
            .then(async (blocks) => {
              if (blocks.watch_blocks.length > 0) {
                blocks.watch_blocks.forEach(async (block) => {
                  if (block.watch_id === metadata.id) {
                    // player is currently blocked
                    return await db
                      .unblockSellerByWatchId(metadata.id, metadata.seller)
                      .then(async () => {
                        return await db
                          .showWatchById(metadata.id)
                          .then(async (watch) => {
                            const btnRow = buttonBuilder([
                              {
                                type: "watchNotificationSnooze",
                                active: watch.snoozed,
                              },
                              {
                                type: "watchNotificationUnwatch",
                                active: !watch.active,
                              },
                              { type: "watchBlock" },
                              { type: "watchNotificationWatchRefresh" },
                            ]);
                            return await i.update({
                              content: `Auctions from \`${formatCapitalCase(
                                metadata.seller
                              )}\` are no longer being blocked for this watch.`,
                              components: [btnRow],
                            });
                          });
                      })
                      .catch(async (err) => {
                        return await gracefulError(i, err);
                      });
                  }
                });
              } else {
                return await db
                  .blockSellerByWatchId(metadata.id, metadata.seller)
                  .then(async () => {
                    return await db
                      .showWatchById(metadata.id)
                      .then(async (watch) => {
                        // TODO: check snooze and unwatch status - don't assume
                        const btnRow = buttonBuilder([
                          {
                            type: "watchNotificationSnooze",
                            active: watch.snoozed,
                          },
                          {
                            type: "watchNotificationUnwatch",
                            active: !watch.active,
                          },
                          { type: "watchBlock", active: true },
                          { type: "watchNotificationWatchRefresh" },
                        ]);
                        return await i.update({
                          content: `Auctions from \`${formatCapitalCase(
                            metadata.seller
                          )}\` have been blocked for this watch.`,
                          components: [btnRow],
                        });
                      });
                  })
                  .catch(async (err) => {
                    return await gracefulError(i, err);
                  });
              }
            });
        case "watchNotificationSnooze":
          return await db.showWatchById(metadata.id).then(async (watch) => {
            const sellerBlockActive = await db.isBlockedSellerActive(
              metadata.id,
              metadata.seller
            );
            // if already snoozed, unsnooze
            if (watch.snoozed) {
              // careful, snoozed vs itemSnooze is ambiguously used
              return await db
                .unsnooze("item", metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
                .then(async (res) => {
                  // include block seller button for watch notifications
                  const buttonConfig = [
                    { type: "watchNotificationSnooze" },
                    { type: "watchNotificationUnwatch" },
                    { type: "watchBlock", active: sellerBlockActive },
                    { type: "watchNotificationWatchRefresh" },
                  ];
                  const btnRow = buttonBuilder(buttonConfig);
                  return await i.update({
                    content: "This watch has been unsnoozed.",
                    components: [btnRow],
                  });
                })
                .catch(async (err) => {
                  return await gracefulError(i, err);
                });
            }
            // if not already snoozed, snooze
            return await db
              .snooze("item", metadata.id) // TODO: ensure db snoozes always return id and not watch_id/user_id
              .then(async (res) => {
                // include block seller button for watch notifications
                const buttonConfig = [
                  { type: "watchNotificationSnooze", active: true },
                  { type: "watchNotificationUnwatch" },
                  { type: "watchBlock", active: sellerBlockActive },
                  { type: "watchNotificationWatchRefresh" },
                ];
                const btnRow = buttonBuilder(buttonConfig);
                return await i.update({
                  content: "This watch has been snoozed for 6 hours.",
                  components: [btnRow],
                });
              })

              .catch(async (err) => {
                return await gracefulError(i, err);
              });
          });

        case "watchNotificationUnwatch":
          // first get status to determine if unwatching or undoing an unwatch button command
          return await db.showWatchById(metadata.id).then(async (watch) => {
            const sellerBlockActive = await db.isBlockedSellerActive(
              metadata.id,
              metadata.seller
            );
            // if watch is active, unwatch it
            if (watch.active) {
              return await db
                .endWatch(null, null, null, metadata.id)
                .then(async (res) => {
                  const btnRow = buttonBuilder([
                    { type: "watchNotificationSnooze", active: res.snoozed },
                    { type: "watchNotificationUnwatch", active: !res.active },
                    { type: "watchBlock", active: sellerBlockActive },
                    { type: "watchNotificationWatchRefresh" },
                  ]);
                  // snoozing an inactive watch is a confusing user experience, so let's disable the button
                  btnRow.components[0].setDisabled(true);
                  // same goes for blockSeller
                  btnRow.components[2].setDisabled(true);
                  return await i.update({
                    content: "This watch has been unwatched.",
                    components: [btnRow],
                  });
                })
                .catch(async (err) => {
                  return await gracefulError(i, err);
                });
            }
            // otherwise watch is inactive, meaning a user is undoing a previous unwatch cmd
            return await db
              .extendWatch(metadata.id)
              .then(async (res) => {
                const btnRow = buttonBuilder([
                  { type: "watchNotificationSnooze", active: res.snoozed },
                  { type: "watchNotificationUnwatch", active: !res.active },
                  { type: "watchBlock", active: sellerBlockActive },
                  { type: "watchNotificationWatchRefresh" },
                ]);
                return await i.update({
                  content: "This watch is now active again.",
                  components: [btnRow],
                });
              })
              .catch(async (err) => {
                return await gracefulError(i, err);
              });
          });
        case "watchNotificationWatchRefresh":
          return await db
            .extendWatch(metadata.id)
            .then(async (res) => {
              const sellerBlockActive = await db.isBlockedSellerActive(
                metadata.id,
                metadata.seller
              );
              const btnRow = buttonBuilder([
                { type: "watchNotificationSnooze", active: res.snoozed },
                { type: "watchNotificationUnwatch", active: !res.active },
                { type: "watchBlock", active: sellerBlockActive },
                { type: "watchNotificationWatchRefresh", active: true },
              ]);
              return await i.update({
                content: "This watch has been extended another 7 days!",
                components: [btnRow],
              });
            })
            .catch(async (err) => {
              return await gracefulError(i, err);
            });
        default:
          return null;
      }
    } else {
      i.reply({ content: "These buttons aren't for you!", ephemeral: true });
    }
  });
}

function buildListResponse(data) {
  if (data && data.length > 0) {
    const globalSnooze = data[0].global_snooze;
    const watches = [];
    data.forEach((watch) => {
      const expiration = moment(watch.datetime).add(7, "days");
      const now = moment(new Date());
      const diff = expiration.diff(now);
      const diffDuration = moment.duration(diff);
      const price =
        watch.price == -1
          ? "No Price Criteria"
          : watch.price.toString().concat("pp");
      watches.push({
        name: `\`${
          watch.watch_snooze || globalSnooze ? "💤 " : ""
        }${formatCapitalCase(
          watch.name
        )}\` | \`${price}\` | \`${formatCapitalCase(watch.server)}\``,
        value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours and ${diffDuration.minutes()} minutes`,
        inline: false,
      });
    });
    const embed = new EmbedBuilder()
      .setTitle(
        globalSnooze
          ? "__Active Watches (Global Snooze Active)__"
          : "__Active Watches__"
      )
      .addFields(watches);
    return [embed];
  } else {
    return "You don't have any watches.  Add some with /watch";
  }
}

async function watchBuilder(watchesToBuild) {
  const urls = await Promise.all(
    watchesToBuild.map(async (item) => {
      return await fetchImageUrl(item.name);
    })
  );

  const embeds = watchesToBuild.map((watch, index) => {
    const watches = [];
    const expiration = moment(watch.datetime).add(7, "days");
    const now = moment(new Date());
    const diff = expiration.diff(now);
    const diffDuration = moment.duration(diff);
    const snoozeExpiration = moment(watch.expiration).add(0, "seconds");
    const snoozeDiff = snoozeExpiration.diff(now);
    const snoozeDuration = moment.duration(snoozeDiff);
    const price =
      watch.price == -1 || watch.price == null
        ? "No Price Criteria"
        : watch.price.toString().concat("pp");
    const item = formatCapitalCase(watch.name);
    const server = `${formatCapitalCase(watch.server)} Server`;
    // const url = await fetchImageUrl(item).catch(console.error);

    watches.push({
      name: `${price}   |   ${server}`,
      value: `Expires in ${diffDuration.days()} days ${diffDuration.hours()} hours  and ${diffDuration.minutes()} minutes`,
      inline: false,
    });

    if (watch.snoozed) {
      watches.push({
        name: "💤 💤 💤 💤  💤  💤 💤 💤 💤 💤  💤",
        value: `Snoozed for another ${snoozeDuration.hours()} hours and ${snoozeDuration.minutes()} minutes`,
        inline: false,
      });
    }

    const matchingItemName = !!wiki_url[watch.name.toUpperCase()];
    const href = matchingItemName
      ? `https://wiki.project1999.com${wiki_url[watch.name.toUpperCase()]}`
      : null;
    return new EmbedBuilder()
      .setColor(SERVER_COLOR[watch.server])
      .setAuthor({ name: "Auction Watch", url: href, iconURL: urls[index] })
      .addFields(watches)
      .setTitle(formatCapitalCase(watch.name))
      .setFooter({
        text: "To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo extend this watch, click ♻️",
      });
  });
  return Promise.resolve(embeds);
}

async function watchNotificationBuilder({
  item,
  price,
  server,
  seller,
  fullAuction,
  timestamp,
}) {
  const thumbnailUrl = await fetchImageUrl(item).catch(console.error);
  const formattedPrice = price ? `${price}pp` : "No Price Listed";
  const historical_pricing = await fetchWikiPricing(item, server);

  const fields = [];

  fields.push({
    name: formattedPrice || "No Price Listed",
    value: `${formatCapitalCase(item)}`,
    inline: false,
  });

  if (historical_pricing) {
    fields.push({
      name: "Historical Pricing Data",
      value: historical_pricing,
      inline: false,
    });
  }

  const msg = new EmbedBuilder()
    .setColor(SERVER_COLOR[server])
    .setImage(thumbnailUrl)
    .setTitle(`${formatCapitalCase(item)}`)
    .setAuthor({
      name: "Watch Notification",
      iconURL: thumbnailUrl,
      url: wiki_url[item]
        ? `https://wiki.project1999.com${wiki_url[item]}`
        : null,
    })
    // .setAuthor('Watch Notification', thumbnailUrl, wiki_url[item] ? `https://wiki.project1999.com${wiki_url[item]}` : null)
    .setDescription(
      `**${seller}** is currently selling **${formatCapitalCase(item)}** ${
        price ? "for **" + price + "pp**" : ""
      } on Project 1999 **${formatCapitalCase(
        server
      )}** server. \n\n\`\`${removeLogTimestamp(fullAuction)}\`\``
    )
    .addFields(fields)
    .setFooter({
      text: `To snooze this watch for 6 hours, click 💤\nTo end this watch, click ❌\nTo ignore auctions by this seller, click 🔕\nTo extend this watch, click ♻️\nWatch expires ${moment(
        timestamp
      )
        .add(7, "days")
        .fromNow()}`,
    })
    .setTimestamp();

  return Promise.resolve([msg]);
}

function blockBuilder(blocksToBuild) {
  const embeds = blocksToBuild.map((block, index) => {
    const blocks = [];
    // eventaully this will need to be refactored in order to run more than 2 servers
    const server =
      block.server.length > 1
        ? "All Servers"
        : `${formatCapitalCase(block.server[0])} Server`;

    // name is item name - meaning it's a watch block
    if (block.name) {
      blocks.push({
        name: `${formatCapitalCase(block.seller)}`,
        value:
          `${formatCapitalCase(block.name)} | ` +
          ` ${formatCapitalCase(block.server)} Server`,
        inline: false,
      });
    } else {
      blocks.push({
        name: `${formatCapitalCase(block.seller)}`,
        value: `${formatCapitalCase(server)}`,
        inline: false,
      });
    }

    return new EmbedBuilder()
      .setColor(SERVER_COLOR[block.server])
      .addFields(blocks)
      .setTitle(block.name ? "Watch Block" : "Global Block")
      .setFooter({ text: "To remove this block, click ❌" });
  });
  return embeds;
}

function buttonBuilder(buttonTypes) {
  const row = new ActionRowBuilder();
  const buttons = buttonTypes.map((button) => {
    switch (button.type) {
      case "itemSnooze":
        return new ButtonBuilder()
          .setCustomId("itemSnooze")
          .setLabel("💤")
          .setStyle(button.active ? ButtonStyle.Primary : ButtonStyle.Secondary);
      case "globalSnooze":
        return new ButtonBuilder()
          .setCustomId("globalSnooze")
          .setLabel("💤")
          .setStyle(button.active ? ButtonStyle.Primary : ButtonStyle.Secondary);
      case "unwatch":
        return new ButtonBuilder()
          .setCustomId("unwatch")
          .setLabel("❌")
          .setStyle(button.active ? ButtonStyle.Danger : ButtonStyle.Secondary);

      case "itemRefresh":
        return new ButtonBuilder()
          .setCustomId("itemRefresh")
          .setLabel("♻️")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);

      case "globalRefresh":
        return new ButtonBuilder()
          .setCustomId("globalRefresh")
          .setLabel("♻️")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);
      case "globalUnblock":
        return new ButtonBuilder()
          .setCustomId("globalUnblock")
          .setLabel("❌")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);
      case "watchBlock":
        return new ButtonBuilder()
          .setCustomId("watchBlock")
          .setLabel("🔕")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);
      case "watchUnblock":
        return new ButtonBuilder()
          .setCustomId("watchUnblock")
          .setLabel("❌")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);
      case "watchNotificationSnooze":
        return new ButtonBuilder()
          .setCustomId("watchNotificationSnooze")
          .setLabel("💤")
          .setStyle(button.active ? ButtonStyle.Primary : ButtonStyle.Secondary);
      case "watchNotificationUnwatch":
        return new ButtonBuilder()
          .setCustomId("watchNotificationUnwatch")
          .setLabel("❌")
          .setStyle(button.active ? ButtonStyle.Danger : ButtonStyle.Secondary);
      case "watchNotificationWatchRefresh":
        return new ButtonBuilder()
          .setCustomId("watchNotificationWatchRefresh")
          .setLabel("♻️")
          .setStyle(button.active ? ButtonStyle.Success : ButtonStyle.Secondary);
      default:
        return null;
    }
  });
  return row.addComponents(buttons);
}

function dedupeBlockResults(blockResults) {
  const blockMap = {};
  blockResults.map((block) => {
    if (blockMap[block.seller]) {
      return (blockMap[block.seller] = [
        ...blockMap[block.seller],
        block.server,
      ]);
    }
    return (blockMap[block.seller] = [block.server]);
  });
  return Object.keys(blockMap).map((dedupedBlock) => {
    // just plucking the userId off the first result isn't great, but we'll
    // never use this command for multiple users
    return {
      user_id: blockResults[0].user_id,
      seller: dedupedBlock,
      server: blockMap[dedupedBlock],
    };
  });
}

//	to be used to handle errors at the top level in command files.
// 	there is one last try catch block outside the command files as a fail safe
// 	ideally executors and clientHelpers should not catch any errors so they bubble up
const gracefulError = async (interaction, err) => {
  // log to console as a safety
  console.error(err.message);
  // inform user an error occured
  await interaction.reply({
    content: "Sorry, an error occured.  Please try again.",
    ephemeral: true,
  });
  // pass thru to error log channel
  const channelId = settings.discord.logs;
  const logsChannel = await interaction.client.channels.fetch(channelId);
  logsChannel.send(
    `${interaction.user.username} threw the following error:\n\n${err.stack}`
  );
};

const gracefulSystemError = async (client, err) => {
  // log to console as a safety
  console.error(err.message);
  // pass thru to error log channel
  const channelId = settings.discord.logs;
  const logsChannel = await client.channels.fetch(channelId);
  logsChannel.send(`[ SYSTEM ERROR ]:\n\n${err.stack}`);
};

async function sendMessagesToUser(
  interaction,
  userId,
  messages,
  components,
  metadataItems
) {
  const user = await interaction.client.users.fetch(userId);
  if (!messages || messages.length < 1) return;
  const postedMessages = await Promise.all(
    messages.map(async (message, index) => {
      return await user
        .send({ embeds: [message], components: [components[index]] })
        .then(async (postedMessage) => {
          return await collectButtonInteractions(
            interaction,
            metadataItems[index],
            postedMessage
          );
        });
    })
  );

  return postedMessages;
}

const troubleshootingLinkEmbed = new EmbedBuilder().addFields([
    {
        name: `ISSUE: Slash Commands Won't Work`,
        value: `[Learn More](https://discord.com/channels/643500242846744611/836431631073935381/1003850402787242014)`
    }
]);

module.exports = {
  MessageType,
  watchBuilder,
  buttonBuilder,
  blockBuilder,
  sendMessagesToUser,
  collectButtonInteractions,
  buildListResponse,
  dedupeBlockResults,
  gracefulError,
  gracefulSystemError,
  watchNotificationBuilder,
  troubleshootingLinkEmbed
};
