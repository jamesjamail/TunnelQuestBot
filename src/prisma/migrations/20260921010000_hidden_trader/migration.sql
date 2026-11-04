-- One-way dismissal of a marketplace trader, applied when matches are read.
-- Separate from BlockedTrader, which is mutual and applied when matches are made.

-- CreateTable
CREATE TABLE "HiddenTrader" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "hiddenDiscordUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    CONSTRAINT "HiddenTrader_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HiddenTrader_discordUserId_hiddenDiscordUserId_key" ON "HiddenTrader"("discordUserId", "hiddenDiscordUserId");
