-- Persistent notification throttle, independent of MarketplaceMatch. A
-- counterparty ending and restoring their own watch deletes and recreates
-- the match row (deleteMarketplaceMatchesForWatchIds), which would otherwise
-- let them re-trigger a notification to the same recipient every sweep; this
-- table's rows are never touched by that.

-- CreateTable
CREATE TABLE "MarketplaceNotificationHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipientDiscordUserId" TEXT NOT NULL,
    "counterpartDiscordUserId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL CHECK (length("itemName") <= 255),
    "server" TEXT NOT NULL CHECK ("server" IN ('BLUE', 'GREEN', 'RED')),
    "side" TEXT NOT NULL CHECK ("side" IN ('wtb', 'wts')),
    "notifiedAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceNotificationHistory_recipientDiscordUserId_counterpartDiscordUserId_itemName_server_side_key" ON "MarketplaceNotificationHistory"("recipientDiscordUserId", "counterpartDiscordUserId", "itemName", "server", "side");
