const { Client } = require("pg");
const settings = require("../settings/settings.json");

// This file should contain db functions only - nothing discord related should be here

const connection = new Client({
  host: settings.sql.host,
  port: settings.sql.port,
  user: settings.sql.user,
  database: settings.sql.database,
  password: settings.sql.password,
});

connection.connect((err) => {
  if (err) {
    console.error(err);
  } else {
    console.log("connected to postgres db");
  }
});

// verify thsi works now that its asnyc
async function findOrAddUser(user) {
  // TODO: make this better with INSERT...ON CONFLICT
  // SELECT user ID based on USERNAME
  const queryStr = "SELECT id FROM users WHERE name = $1";
  return await connection
    .query(queryStr, [user])
    .then(async (results) => {
      // IF USERNAME does not exist...
      if (results.rows.length === 0) {
        const queryStr = "INSERT INTO users (name) VALUES ($1) RETURNING id";
        return await connection.query(queryStr, [user]).then((results) => {
          return Promise.resolve(results.rows[0].id);
        });
      } else {
        return Promise.resolve(results.rows[0].id);
      }
    })
    .catch((err) => Promise.reject(err));
}

async function findOrAddItem(item) {
  // SELECT user ID based on ITEMNAME
  const queryStr = "SELECT id FROM items WHERE name = $1";
  return await connection
    .query(queryStr, [item.toUpperCase()])
    .then(async (results) => {
      if (results.rows.length === 0) {
        const queryStr = "INSERT INTO items (name) VALUES ($1) RETURNING id";
        return await connection
          .query(queryStr, [item.toUpperCase()])
          .then((res) => {
            return Promise.resolve(res.rows[0].id);
          });
      } else {
        return Promise.resolve(results.rows[0].id);
      }
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

//	getWatches delivers all watches to logParser
// TODO: this function should not return duplicate items, just the item once with lowest price
function getWatches(callback) {
  const query =
    "SELECT watches.id AS watch_id, items.name AS item_name, user_id, users.name AS user_name, price, server, datetime as timestamp " +
    "FROM items " +
    "INNER JOIN watches ON watches.item_id = items.id " +
    "INNER JOIN users ON watches.user_id = users.id WHERE active = true;";
  connection
    .query(query)
    .then((res) => {
      callback(res.rows);
    })
    .catch((err) => console.error(err));
}

async function addWatch(user, item, server, price, watchId) {
  // if already have watchId, simple update -- Do we use this? or the separate function
  if (watchId) {
    const queryStr = "UPDATE watches SET active = true WHERE id = $1;";
    return await connection.query(queryStr, [watchId]);
  }

  // otherwise add each item individually...

  // convert price from 1k to 1000pp
  // -1 denotes no price filter
  // this also prevents user from entering a maximum price of 0
  const convertedPrice = !price ? -1 : Number(price);

  return findOrAddUser(user).then((results) => {
    const userId = results;
    return findOrAddItem(item).then(async (results) => {
      const itemId = results;

      const queryStr =
        "" +
        "UPDATE watches " +
        "SET user_id = $1, item_id = $2, price = $3, server = $4, active = TRUE, datetime = current_timestamp " +
        "WHERE user_id = $1 AND item_id = $2 AND server = $4 RETURNING watches.id";
      return await connection
        .query(queryStr, [userId, itemId, convertedPrice, server])
        .then(async (results) => {
          if (results.rowCount === 0) {
            const queryStr =
              "" +
              "INSERT INTO watches (user_id, item_id, price, server, datetime, active) " +
              "VALUES ($1, $2, $3, $4, current_timestamp, true) RETURNING id";
            return await connection
              .query(queryStr, [userId, itemId, convertedPrice, server])
              .then(async (res) => {
                return await showWatchById(res.rows[0].id);
              });
          }
          // adding a watch should unsnooze it
          return await unsnooze("item", results.rows[0].id).then(
            async (res) => {
              return await showWatchById(results.rows[0].id);
            }
          );
        })
        .catch((err) => {
          Promise.reject(err);
        });
    });
  });
}

async function endWatch(user, item, server, watchId) {
  if (watchId) {
    const queryStr = "UPDATE watches SET active = false WHERE id = $1;";
    return await connection
      .query(queryStr, [watchId])
      .then(async (res) => {
        return await showWatchById(watchId);
      })
      .catch((err) => {
        Promise.reject(err);
      });
  } else {
    return await findOrAddUser(user)
      .then(async (userId) => {
        return await findOrAddItem(item).then(async (itemId) => {
          if (server) {
            const queryStr =
              "UPDATE watches SET active = false WHERE user_id = $1 AND item_id = $2 AND server = $3;";
            return await connection
              .query(queryStr, [userId, itemId, server])
              .then((res) => {
                return Promise.resolve(res);
              })
              .catch(console.error);
          }
          // no server supplied, delete both watches
          // TODO: could warn users if they have 2 watches under the same name, ambigious delete
          const queryStr =
            "UPDATE watches SET active = false WHERE user_id = $1 AND item_id = $2;";
          return await connection
            .query(queryStr, [userId, itemId])
            .then((res) => {
              return Promise.resolve(res);
            })
            .catch(console.error);
        });
      })
      .catch((err) => {
        Promise.reject(err);
      });
  }
}

async function endAllWatches(user) {
  return await findOrAddUser(user)
    .then(async (userId) => {
      const queryStr = "UPDATE watches SET active = false WHERE user_id = $1";
      return await connection.query(queryStr, [userId]);
    })
    .catch((err) => {
      console.error(err);
    });
}

async function getIndividualWatch(watchId) {
  const queryStr =
    "" +
    "SELECT watches.id, items.name, price, server, datetime, expiration, " +
    "CASE WHEN expiration IS NULL OR expiration < now() THEN FALSE " +
    "WHEN expiration >= now() THEN TRUE END AS snoozed " +
    "FROM watches " +
    "INNER JOIN items ON items.id = item_id " +
    "LEFT JOIN snooze_by_watch ON snooze_by_watch.watch_id = watches.id " +
    "WHERE watches.id = $1 AND watches.active = true " +
    "AND expiration IS NULL OR expiration > now();";
  return connection
    .query(queryStr, [watchId])
    .then((res) => {
      return Promise.resolve(res.rows);
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

async function showWatch(user, item) {
  return await findOrAddUser(user)
    .then((results) => {
      const userId = results;
      const pattern = "%".concat(item.toUpperCase()).concat("%");
      const queryStr =
        "" +
        "SELECT watches.id, items.name, price, server, datetime, expiration, " +
        "CASE WHEN expiration IS NULL OR expiration < now() THEN FALSE " +
        "WHEN expiration >= now() THEN TRUE END AS snoozed " +
        "FROM watches " +
        "INNER JOIN items ON items.id = item_id " +
        "LEFT JOIN snooze_by_watch ON snooze_by_watch.watch_id = watches.id " +
        "WHERE watches.user_id = $1 AND items.name LIKE $2 AND watches.active = true";
      ("AND expiration IS NULL OR expiration > now() ORDER BY items.name ASC;");
      return connection.query(queryStr, [userId, pattern]).then((res) => {
        return Promise.resolve(res.rows);
      });
    })
    .catch(console.error);
}

async function showWatchById(id) {
  // careful...this returns watchInfo if if watch is inactive!
  const queryStr =
    "" +
    "SELECT watches.id, items.name, price, server, active, datetime, expiration," +
    "CASE WHEN snooze_by_watch.watch_id IS NULL THEN FALSE " +
    "WHEN snooze_by_watch.watch_id IS NOT NULL THEN TRUE END AS snoozed " +
    "FROM watches " +
    "INNER JOIN items ON items.id = item_id " +
    "LEFT JOIN snooze_by_watch ON snooze_by_watch.watch_id = watches.id " +
    "WHERE watches.id = $1 ";
  ("AND expiration IS NULL OR expiration > now() ORDER BY items.name ASC;");
  return connection.query(queryStr, [id]).then((res) => {
    return Promise.resolve(res.rows.length > 0 ? res.rows[0] : null);
  });
}

async function listWatches(user) {
  return await findOrAddUser(user)
    .then(async (userId) => {
      const queryStr =
        "" +
        "SELECT watches.id, items.name, price, server, datetime, snooze_by_watch.expiration, CASE " +
        "WHEN snooze_by_watch.expiration IS NULL OR snooze_by_watch.expiration < now() THEN FALSE " +
        "WHEN snooze_by_watch.expiration >= now() THEN TRUE " +
        "END AS watch_snooze, " +
        "snooze_by_user.expiration, CASE " +
        "WHEN snooze_by_user.expiration IS NULL OR snooze_by_user.expiration < now() THEN FALSE " +
        "WHEN snooze_by_user.expiration >= now() THEN TRUE " +
        "END AS global_snooze " +
        "FROM watches " +
        "INNER JOIN items ON items.id = item_id " +
        "LEFT JOIN snooze_by_watch ON watch_id = watches.id " +
        "LEFT JOIN snooze_by_user ON snooze_by_user.user_id = watches.user_id " +
        "WHERE watches.user_id = $1 AND watches.active = TRUE " +
        "ORDER BY items.name;";
      return await connection.query(queryStr, [userId]).then((res) => {
        return Promise.resolve(res.rows);
      });
    })
    .catch((err) => {
      Promise.reject(err);
    });
}

async function extendWatch(watchId) {
  const queryStr =
    "UPDATE watches SET datetime = current_timestamp, active = TRUE WHERE watches.id = $1";
  return await connection.query(queryStr, [watchId]).then(async (res) => {
    // extending watches should unsnooze them
    return await unsnooze("item", watchId).catch(console.error);
  });
}

async function extendAllWatches(user) {
  const queryStr =
    "" +
    "UPDATE watches " +
    "SET datetime = current_timestamp " +
    "FROM users " +
    "WHERE watches.user_id = users.id AND users.name = $1 AND active = true;";
  return await connection
    .query(queryStr, [user])
    .then(async (res) => {
      return await listWatches(user);
    })
    .catch(console.error);
}

async function blockSellerByWatchId(watchId, seller) {
  const queryStr =
    "INSERT INTO blocked_seller_by_watch (seller, watch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING";
  return await connection
    .query(queryStr, [seller.toUpperCase(), watchId])
    .catch((err) => {
      Promise.reject(err);
    });
}

// TODO cast strings to uppercase before inserting
async function blockSellerGlobally(user, seller, server) {
  // add or find user
  return await findOrAddUser(user)
    .then(async (userId) => {
      if (server) {
        const queryStr =
          "INSERT INTO blocked_seller_by_user (seller, user_id, server) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING";
        return await connection
          .query(queryStr, [seller.toUpperCase(), userId, server.toUpperCase()])
          .then(async (res) => {
            return await showBlocks(user, seller.toUpperCase());
          });
      } else {
        // no server, so add blocks for both servers
        // it's possible this bot could need to run on more than 2 servers,
        // which is why there is a slightly cumbersome process of adding blocks
        // when a server isn't specified.
        // TODO: had to change unique constraint to include server (unique user seller server) - see if that was done recently
        const queryStr =
          "INSERT INTO blocked_seller_by_user (seller, user_id, server) VALUES ($1, $2, 'GREEN'), ($1, $2, 'BLUE') ON CONFLICT DO NOTHING;";
        return await connection
          .query(queryStr, [seller.toUpperCase(), userId])
          .then(async (res) => {
            return await showBlocks(user, seller.toUpperCase());
          });
      }
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}

async function unblockSellerByWatchId(watchId, seller) {
  const queryStr =
    "DELETE FROM blocked_seller_by_watch WHERE seller = $1 AND watch_id = $2;";
  return await connection
    .query(queryStr, [seller.toUpperCase(), watchId])
    .catch(console.error)
    .catch((err) => {
      return Promise.reject(err);
    });
}

async function unblockSellerGlobally(user, seller, server) {
  return await findOrAddUser(user)
    .then(async (userId) => {
      if (server) {
        const queryStr =
          "DELETE FROM blocked_seller_by_user WHERE seller = $1 AND user_id = $2 AND server = $3;";
        return await connection
          .query(queryStr, [seller.toUpperCase(), userId, server.toUpperCase()])
          // Also unblock any watch blocks for said user
          .then(async (globalBlockRes) => {
            const queryStr =
              "DELETE FROM blocked_seller_by_watch INNER JOIN watches ON watches.id = blocked_seller_by_watch.watch_id WHERE seller = $1 AND watches.user_id = $2 AND watches.server = $3;";
            return await connection
              .query(queryStr, [
                seller.toUpperCase(),
                userId,
                server.toUpperCase(),
              ])
              .catch(console.error)
              .then((watchBlockRes) => {
                //	if either globalBlock or watchBlock affected rows, return that rowCount
                if (globalBlockRes.rowCount > 0) {
                  return Promise.resolve(globalBlockRes);
                }
                if (watchBlockRes.rowCount > 0) {
                  return Promise.resolve(watchBlockRes);
                }
                // if niether had any impact, return either one (currently res.rowCount is the only property that matters on the return)
                return Promise.resolve(globalBlockRes);
              });
          });
      } else {
        const queryStr =
          "DELETE FROM blocked_seller_by_user WHERE seller = $1 AND user_id = $2;";
        return await connection
          .query(queryStr, [seller.toUpperCase(), userId])
          // Also unblock any watch blocks for said user
          .then(async (globalBlockRes) => {
            const queryStr =
              "DELETE FROM blocked_seller_by_watch using watches WHERE watches.id = blocked_seller_by_watch.watch_id AND seller = $1 AND watches.user_id = $2;";
            return await connection
              .query(queryStr, [seller.toUpperCase(), userId])
              .catch(console.error)
              .then((watchBlockRes) => {
                //	if either globalBlock or watchBlock affected rows, return that rowCount
                if (globalBlockRes.rowCount > 0) {
                  return Promise.resolve(globalBlockRes);
                }
                if (watchBlockRes.rowCount > 0) {
                  return Promise.resolve(watchBlockRes);
                }
                // if niether had any impact, return either one (currently res.rowCount is the only property that matters on the return)
                return Promise.resolve(globalBlockRes);
              });
          });
      }
    })
    .catch((err) => Promise.reject(err));
}

async function showBlocks(user, seller) {
  return await findOrAddUser(user)
    .then(async (userId) => {
      if (!seller) {
        const queryStr =
          "SELECT name AS user_id, seller, server FROM blocked_seller_by_user INNER JOIN users ON users.id = blocked_seller_by_user.user_id WHERE user_id = $1";
        return await connection
          .query(queryStr, [userId])
          .then(async (user_blocks) => {
            // I'm not sure whether to only show watch blocks for active watches.  I think deleting watch blocks on /unwatch is bad because we allow users to "turn back on watches" after unwatching via button/
            // Can show them all I suppose, but they might not be relevant to the user if the watch isn't active.
            const queryStr =
              "SELECT seller, server, items.name, watches.server as item_server, watches.id AS watch_id FROM blocked_seller_by_watch INNER JOIN watches ON blocked_seller_by_watch.watch_id = watches.id INNER JOIN items ON items.id = watches.item_id WHERE user_id = $1 AND watches.active = TRUE";
            return await connection
              .query(queryStr, [userId])
              .then((watch_blocks) => {
                return Promise.resolve({
                  user_blocks: user_blocks.rows,
                  watch_blocks: watch_blocks.rows,
                });
              });
          });
      }
      const pattern = "%".concat(seller.toUpperCase()).concat("%");
      const queryStr =
        "SELECT seller, server FROM blocked_seller_by_user WHERE user_id = $1 AND seller LIKE $2";
      return await connection
        .query(queryStr, [userId, pattern])
        .then(async (user_blocks) => {
          const queryStr =
            "SELECT seller, server, items.name, watches.server as item_server, watches.id AS watch_id FROM blocked_seller_by_watch INNER JOIN watches ON blocked_seller_by_watch.watch_id = watches.id INNER JOIN items ON items.id = watches.item_id WHERE user_id = $1 AND seller like $2";
          return await connection
            .query(queryStr, [userId, pattern])
            .then(async (watch_blocks) => {
              return Promise.resolve({
                user_blocks: user_blocks.rows,
                watch_blocks: watch_blocks.rows,
              });
            });
        });
    })
    .catch((err) => Promise.reject(err));
}

async function snoozeByItemName(discordId, itemName, hours = 6) {
  // find the watch based on item name
  return await findOrAddUser(discordId).then(async (userId) => {
    return await findOrAddItem(itemName).then(async (itemId) => {
      const query =
        "SELECT id FROM watches WHERE user_id = $1 AND item_id = $2 AND active = TRUE;";
      return await connection
        .query(query, [userId, itemId])
        .then(async ({ rows }) => {
          if (!rows || rows.length < 1) {
            return Promise.resolve(rows);
          }
          return await snooze("item", rows[0].id, hours).then(
            async (results) => {
              return Promise.resolve({
                results,
                metadata: {
                  id: rows[0].id,
                  itemSnooze: false,
                  active: true,
                },
              });
            }
          );
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    });
  });
}

async function unsnoozeByItemName(discordId, itemName, server) {
  // find the watch based on item name
  return await findOrAddUser(discordId).then(async (userId) => {
    return await findOrAddItem(itemName).then(async (itemId) => {
      if (server) {
        // TODO: instead of limiting 1 below, handle edge case of the same item watched under both servers
        const queryStr =
          "SELECT id FROM watches WHERE watches.user_id = $1 AND watches.item_id = $2 AND watches.server = $3 AND active = TRUE LIMIT 1";
        return await connection
          .query(queryStr, [userId, itemId, server.toUpperCase()])
          .then(async ({ rows }) => {
            if (!rows || rows.length < 1) {
              return Promise.resolve({ rows });
            }
            return await unsnooze("ITEM", rows[0].id).then((results) => {
              return Promise.resolve({
                results,
                metadata: { id: rows[0].id, itemSnooze: false, active: true },
              });
            });
          });
      }
      // TODO: instead of limiting 1 below, handle edge case of the same item watched under both servers
      const queryStr =
        "SELECT id FROM watches WHERE watches.user_id = $1 AND watches.item_id = $2 AND active = TRUE LIMIT 1";
      return await connection
        .query(queryStr, [userId, itemId])
        .then(async ({ rows }) => {
          if (!rows || rows.length < 1) {
            return Promise.resolve({ rows });
          }
          return await unsnooze("ITEM", rows[0].id).then((results) => {
            return Promise.resolve({
              results,
              metadata: { id: rows[0].id, itemSnooze: false, active: true },
            });
          });
        });
    });
  });
}

async function snooze(type, id, hours = 6) {
  switch (type.toUpperCase()) {
    case "ITEM":
      // insert into watch snoooze
      return (async () => {
        const queryStr =
          "INSERT INTO snooze_by_watch (watch_id, expiration) VALUES ($1, now() + interval '1 second' * $2) ON CONFLICT (watch_id) DO UPDATE SET expiration = now() + interval '1 second' * $2;";
        return await connection
          .query(queryStr, [id, hours * 60 * 60])
          .then(async (res) => {
            return await showWatchById(id);
          })
          .catch(console.error);
      })();
    case "GLOBAL":
      return findOrAddUser(id)
        .then((userId) => {
          // insert into account snooze
          return (async () => {
            const queryStr =
              "INSERT INTO snooze_by_user (user_id, expiration) VALUES ($1, now() + interval '1 hour' * $2) ON CONFLICT (user_id) DO UPDATE SET expiration = now() + interval '1 hour' * $2;";
            return await connection
              .query(queryStr, [userId, hours])
              .then(async (res) => {
                return await listWatches(id);
              })
              .catch(console.error);
          })();
        })
        .catch(console.error);
  }
}

async function unsnooze(type, id) {
  switch (type.toUpperCase()) {
    case "ITEM":
      return (async () => {
        const queryStr = "DELETE FROM snooze_by_watch WHERE watch_id = $1;";
        return await connection
          .query(queryStr, [id])
          .then(async (res) => {
            return await showWatchById(id);
          })
          .catch(console.error);
      })();
    case "GLOBAL":
      return findOrAddUser(id).then((userId) => {
        return (async () => {
          const queryStr = "DELETE FROM snooze_by_user WHERE user_id = $1;";
          return await connection
            .query(queryStr, [userId])
            .then(async (res) => {
              const queryStr =
                "DELETE FROM snooze_by_watch USING watches WHERE snooze_by_watch.watch_id = watches.id AND watches.user_id = $1;";
              return await connection
                .query(queryStr, [userId])
                .then(async () => {
                  return await listWatches(id);
                });
            })
            .catch(console.error);
        })();
      });
  }
}

const isBlockedSellerActive = async (watchId, seller) => {
  const queryStr =
    "SELECT id FROM blocked_seller_by_watch WHERE watch_id = $1 AND seller = $2";
  return await connection
    .query(queryStr, [watchId, seller.toUpperCase()])
    .then((res) => {
      if (res.rows.length > 0) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    })
    .catch(console.error);
};

async function postSuccessfulCommunication(watchId, seller) {
  const queryStr =
    "INSERT INTO communication_history (watch_id, seller, timestamp) VALUES ($1, $2, now()) ON CONFLICT ON CONSTRAINT communication_history_watch_id_seller_key DO UPDATE SET timestamp = now();";
  await connection
    .query(queryStr, [watchId, seller.toUpperCase()])
    .catch(console.error);
}

async function validateWatchNotification(userId, watchId, seller) {
  // check communication history to see if notified in the past 15 minutes
  const queryStr =
    "SELECT id FROM communication_history WHERE watch_id = $1 AND seller = $2 AND timestamp > now() - interval '15 minutes';";
  const isValid = await connection
    .query(queryStr, [watchId, seller.toUpperCase()])
    .then((res) => {
      // notified within 15 minute window already, return false
      if (res.rows && res.rows.length > 0) {
        return false;
      } else {
        // otherwise check if seller is blocked by user
        const queryStr =
          "SELECT seller FROM blocked_seller_by_user WHERE user_id = $1 AND seller = $2";
        return connection
          .query(queryStr, [userId, seller.toUpperCase()])
          .then((res) => {
            if (res && res.rows.length > 0) {
              // return false if seller is blocked by user
              return false;
            } else {
              // otherwise check if seller is blocked by watch
              const queryStr =
                "SELECT seller FROM blocked_seller_by_watch WHERE watch_id = $1 AND seller = $2";
              return connection
                .query(queryStr, [watchId, seller.toUpperCase()])
                .then((res) => {
                  if (res && res.rows.length > 0) {
                    return false;
                  } else {
                    // otherwise check if watch is snoozed
                    const queryStr =
                      "SELECT id FROM snooze_by_watch WHERE watch_id = $1 AND expiration > now()";
                    return connection.query(queryStr, [watchId]).then((res) => {
                      if (res && res.rows.length > 0) {
                        return false;
                      } else {
                        // otherwise check if user is snoozed
                        const queryStr =
                          "SELECT id FROM snooze_by_user WHERE user_id = $1 AND expiration > now()";
                        return connection
                          .query(queryStr, [userId])
                          .then((res) => {
                            if (res && res.rows.length > 0) {
                              return false;
                            } else {
                              // if no results for any of these queries, it's safe to notify the user
                              return true;
                            }
                          });
                      }
                    });
                  }
                });
            }
          });
      }
    })
    .catch(console.error);
  return isValid;
}

function upkeep() {
  const query =
    "UPDATE watches SET active = false WHERE datetime < now() - interval '7 days';";
  connection
    .query(query)
    .then((res) => {
      // TODO: pipe this to a private health_status channel on discord on devs have access to - write a log for every watch notification, command entry, etc.
      // 'Upkeep completed. Removed ', res.rowCount, ' old watches.'
    })
    .catch(console.error);
}

module.exports = {
  addWatch,
  endWatch,
  endAllWatches,
  extendWatch,
  extendAllWatches,
  showWatch,
  showWatchById,
  listWatches,
  snooze,
  snoozeByItemName,
  unsnooze,
  unsnoozeByItemName,
  getWatches,
  postSuccessfulCommunication,
  blockSellerGlobally,
  unblockSellerGlobally,
  unblockSellerByWatchId,
  blockSellerByWatchId,
  showBlocks,
  isBlockedSellerActive,
  validateWatchNotification,
  upkeep,
};
