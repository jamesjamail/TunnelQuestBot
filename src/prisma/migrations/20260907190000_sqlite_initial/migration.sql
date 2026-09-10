-- CHECK constraints retain PostgreSQL varchar, enum and UUID validation.
-- Dates use unixepoch-ms, matching the runtime adapter and imported values.
-- CreateTable
CREATE TABLE "User" (
    "discordUserId" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    "updatedAt" DATETIME NOT NULL,
    "discordUsername" TEXT NOT NULL CHECK (length("discordUsername") <= 255),
    "snoozedUntil" DATETIME
);

-- CreateTable
CREATE TABLE "Watch" (
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
    "isPublicallyTradeable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Watch_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedPlayerByWatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "watchId" INTEGER NOT NULL,
    "player" TEXT NOT NULL CHECK (length("player") <= 255),
    CONSTRAINT "BlockedPlayerByWatch_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlockedPlayerByWatch_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedPlayer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "server" TEXT NOT NULL CHECK ("server" IN ('BLUE', 'GREEN', 'RED')),
    "player" TEXT NOT NULL CHECK (length("player") <= 255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BlockedPlayer_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "server" TEXT CHECK ("server" IN ('BLUE', 'GREEN', 'RED')),
    "player" TEXT CHECK (length("player") <= 255),
    "linkCode" TEXT COLLATE NOCASE CHECK ("linkCode" IS NULL OR (
        length("linkCode") = 36 AND substr("linkCode", 9, 1) = '-'
        AND substr("linkCode", 14, 1) = '-' AND substr("linkCode", 19, 1) = '-'
        AND substr("linkCode", 24, 1) = '-' AND length(replace("linkCode", '-', '')) = 32
        AND replace("linkCode", '-', '') NOT GLOB '*[^0-9a-fA-F]*'
    )),
    "linkCodeExpiry" DATETIME,
    CONSTRAINT "PlayerLink_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataMigration" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "completedAt" DATETIME NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    "counts" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE INDEX "Watch_active_idx" ON "Watch"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_discordUserId_itemName_server_watchType_key" ON "Watch"("discordUserId", "itemName", "server", "watchType");

-- CreateIndex
CREATE INDEX "BlockedPlayerByWatch_discordUserId_idx" ON "BlockedPlayerByWatch"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPlayerByWatch_watchId_player_key" ON "BlockedPlayerByWatch"("watchId", "player");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPlayer_discordUserId_server_player_key" ON "BlockedPlayer"("discordUserId", "server", "player");

-- CreateIndex
CREATE INDEX "PlayerLink_server_player_idx" ON "PlayerLink"("server", "player");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLink_server_player_key" ON "PlayerLink"("server", "player");
