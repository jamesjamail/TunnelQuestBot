-- Marketplace matching: pairs an active WTB watch with an active WTS watch for
-- the same item/server when both sides are marketplace-visible
-- (isPublicallyTradeable, which defaults to true for new watches).
--
-- Every watch that exists before this migration was created without the user
-- knowing it would put their handle in strangers' DMs. Holding them back here
-- is deliberate: without it they would all be enrolled by the default. Their
-- owners can opt in explicitly with /watch marketplace:true.
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
