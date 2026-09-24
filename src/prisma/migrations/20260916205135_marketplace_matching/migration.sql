-- Marketplace matching: pairs an active WTB watch with an active WTS watch for
-- the same item/server when both sides are marketplace-visible
-- (isPublicallyTradeable, opt-in and off by default).
--
-- Every watch that exists before this migration was created without the user
-- knowing it would put their handle in strangers' DMs. Holding them back here
-- is deliberate, and paired with the default flip below so nothing - old or
-- new - ends up enrolled without asking. Owners can opt in explicitly with
-- /watch marketplace:true.
UPDATE "Watch" SET "isPublicallyTradeable" = false;

-- RedefineTables: isPublicallyTradeable's column default was true from the
-- initial migration; this feature makes it opt-in, so the default flips to
-- false. SQLite has no ALTER COLUMN for changing a default in place, so the
-- table is rebuilt; existing rows (already set to false above) are copied
-- across unchanged, and every constraint, index and foreign key is carried
-- over exactly.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Watch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "server" TEXT NOT NULL CHECK ("server" IN ('BLUE', 'GREEN', 'RED')),
    "watchType" TEXT NOT NULL CHECK ("watchType" IN ('WTS', 'WTB')),
    "itemName" TEXT NOT NULL CHECK (length("itemName") <= 255),
    "priceRequirement" INTEGER,
    "created" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "snoozedUntil" DATETIME,
    "notes" TEXT,
    "isPublicallyTradeable" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Watch_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Watch" ("id", "discordUserId", "server", "watchType", "itemName", "priceRequirement", "created", "active", "snoozedUntil", "notes", "isPublicallyTradeable")
SELECT "id", "discordUserId", "server", "watchType", "itemName", "priceRequirement", "created", "active", "snoozedUntil", "notes", "isPublicallyTradeable" FROM "Watch";
DROP TABLE "Watch";
ALTER TABLE "new_Watch" RENAME TO "Watch";
CREATE INDEX "Watch_active_idx" ON "Watch"("active");
CREATE UNIQUE INDEX "Watch_discordUserId_itemName_server_watchType_key" ON "Watch"("discordUserId", "itemName", "server", "watchType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "MarketplaceMatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wtbWatchId" INTEGER NOT NULL,
    "wtsWatchId" INTEGER NOT NULL,
    "server" TEXT NOT NULL CHECK ("server" IN ('BLUE', 'GREEN', 'RED')),
    "itemName" TEXT NOT NULL CHECK (length("itemName") <= 255),
    "createdAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    "wtbNotifiedAt" DATETIME,
    "wtsNotifiedAt" DATETIME,
    CONSTRAINT "MarketplaceMatch_wtbWatchId_fkey" FOREIGN KEY ("wtbWatchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceMatch_wtsWatchId_fkey" FOREIGN KEY ("wtsWatchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceMatch_wtbWatchId_wtsWatchId_key" ON "MarketplaceMatch"("wtbWatchId", "wtsWatchId");

-- CreateIndex
CREATE INDEX "MarketplaceMatch_itemName_server_idx" ON "MarketplaceMatch"("itemName", "server");
