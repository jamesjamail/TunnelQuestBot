-- Discord-user-level block used by marketplace matching. Separate from
-- BlockedPlayer, which is keyed on in-game character name.

-- CreateTable
CREATE TABLE "BlockedTrader" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "blockedDiscordUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    CONSTRAINT "BlockedTrader_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BlockedTrader_blockedDiscordUserId_idx" ON "BlockedTrader"("blockedDiscordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedTrader_discordUserId_blockedDiscordUserId_key" ON "BlockedTrader"("discordUserId", "blockedDiscordUserId");
