const { parsePrice } = require("../utility/utils");

// Poll DB for new watches on a set interval:
//                   s    ms
const pollInterval = 10 * 1000;
const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(.*)'$/;
const WTS_REGEX = /WTS(.*?)(?=WTB|$)/gi;
const WTB_REGEX = /WTB(.*?)(?=WTS|$)/gi;

// stream log file(s)
if (require.main === module) {
  const client = require("../client/client.js");
  const db = require("../db/db.js");
  const settings = require("../settings/settings.json");
  const tail = require("tail");
  let itemList = [];
  for (const server in settings.servers) {
    const log_tail = new tail.Tail(settings.servers[server].log_file_path);
    log_tail.on("line", function (data) {
      parseLog(data, itemList, server, client);
    });
    log_tail.on("error", function (error) {
      console.error("ERROR: ", error);
    });
  }

  setInterval(() => {
    db.upkeep();
    db.getWatches((results) => {
      itemList = results;
    });
  }, pollInterval);
}

// remove any WTB sections from seller message
function filterWTS(auction_contents) {
  const filteredWTS = [...auction_contents.matchAll(WTS_REGEX)];
  let auctionWTS = "";
  for (const section in filteredWTS) {
    auctionWTS += filteredWTS[section][1].trim() + " ";
  }
  return auctionWTS.toUpperCase().trim();
}

// remove any WTS sections from the buyer message
function filterWTB(auction_contents) {
  const filteredWTB = [...auction_contents.matchAll(WTB_REGEX)];
  let auctionWTB = "";
  for (const section in filteredWTB) {
    auctionWTB += filteredWTB[section][1].trim() + " ";
  }
  return auctionWTB.toUpperCase().trim();
}

function parseLog(text, itemList, logServer, client) {
  const outgoing = [];
  // test if is auction
  const auction_text = text.match(AUC_REGEX);
  if (auction_text) {
    const auction_user = auction_text[1];
    const auction_contents = auction_text[2];
    // stream for stream channels
    client.streamAuction(auction_user, auction_contents, logServer);
    const auctionWTS = filterWTS(auction_contents);
    const auctionWTB = filterWTB(auction_contents);

    if (auctionWTS) {
      itemList.forEach(({ watch_id, item_name, user_id, user_name, price, server, timestamp, watch_type }) => {
        if (server === logServer && watch_type === "WTS" && auctionWTS.includes(item_name)) {
          const filteredAuction = auctionWTS.slice(auctionWTS.indexOf(item_name), auctionWTS.length);
          const logPrice = parsePrice(filteredAuction, item_name.length);
          if (price === -1 || (logPrice && logPrice <= price)) {
            const msg = {
              watchId: watch_id,
              userId: user_id,
              userName: user_name,
              itemName: item_name,
              sellingPrice: logPrice,
              seller: auction_user,
              server,
              fullAuction: text,
              timestamp,
            };
            outgoing.push(msg);
          }
        }
      });
    }

    if (auctionWTB) {
      itemList.forEach(({ watch_id, item_name, user_id, user_name, price, server, timestamp, watch_type }) => {
        if (server === logServer && watch_type === "WTB" && auctionWTB.includes(item_name)) {
          const filteredAuction = auctionWTB.slice(auctionWTB.indexOf(item_name), auctionWTB.length);
          const logPrice = parsePrice(filteredAuction, item_name.length);
          if (price === -1 || (logPrice && logPrice >= price)) {
            const msg = {
              watchId: watch_id,
              userId: user_id,
              userName: user_name,
              itemName: item_name,
              buyingPrice: logPrice,
              buyer: auction_user,
              server,
              fullAuction: text,
              timestamp,
            };
            outgoing.push(msg);
          }
        }
      });
    }
  }
  sendDiscordMessages(client, outgoing);
}

async function sendDiscordMessages(client, outgoing) {
  outgoing.forEach(async (msg) => {
    await client.pingUser(
      msg.watchId,
      msg.userName,
      msg.userId,
      msg.seller || msg.buyer, // Handle both WTS and WTB cases
      msg.itemName,
      msg.sellingPrice || msg.buyingPrice, // Handle both WTS and WTB cases
      msg.server,
      msg.fullAuction,
      msg.timestamp,
      msg.watch_type // Pass the watch_type to the pingUser function
    );
  });
}

module.exports = { parseLog, filterWTS };
