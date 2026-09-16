-- Opt-in marketplace matching: pairs an active WTB watch with an active WTS
-- watch for the same item/server once both sides have opted in.
--
-- SQLite has no ALTER COLUMN, so flipping isPublicallyTradeable's default
-- means rebuilding Watch. Only Watch is rebuilt (not User/DataMigration,
-- which prisma migrate dev's auto-diff would also rebuild since it can't see
-- the hand-authored CHECK constraints below) so their CHECK constraints -
-- added by hand in 20260907190000_sqlite_initial - aren't silently dropped.
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

-- Existing rows predate the opt-in feature and were never surfaced for
-- trading; flip them to the new opt-out-by-default posture.
UPDATE "Watch" SET "isPublicallyTradeable" = false;

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
