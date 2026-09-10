-- CreateEnum
CREATE TYPE "Server" AS ENUM ('BLUE', 'GREEN', 'RED');

-- CreateEnum
CREATE TYPE "WatchType" AS ENUM ('WTS', 'WTB');

-- CreateTable
CREATE TABLE "User" (
    "discordUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discordUsername" VARCHAR(255) NOT NULL,
    "snoozedUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("discordUserId")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "server" "Server" NOT NULL,
    "watchType" "WatchType" NOT NULL,
    "itemName" VARCHAR(255) NOT NULL,
    "priceRequirement" INTEGER,
    "lastAlertedTimestamp" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "snoozedUntil" TIMESTAMP(3),
    "notes" TEXT,
    "isPublicallyTradeable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedPlayerByWatch" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "watchId" INTEGER NOT NULL,
    "player" VARCHAR(255) NOT NULL,

    CONSTRAINT "BlockedPlayerByWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedPlayer" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "server" "Server" NOT NULL,
    "player" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BlockedPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_discordUserId_itemName_server_watchType_key" ON "Watch"("discordUserId", "itemName", "server", "watchType");

-- CreateIndex
CREATE INDEX "BlockedPlayerByWatch_discordUserId_idx" ON "BlockedPlayerByWatch"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPlayerByWatch_watchId_player_key" ON "BlockedPlayerByWatch"("watchId", "player");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPlayer_discordUserId_server_player_key" ON "BlockedPlayer"("discordUserId", "server", "player");

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedPlayerByWatch" ADD CONSTRAINT "BlockedPlayerByWatch_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedPlayerByWatch" ADD CONSTRAINT "BlockedPlayerByWatch_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedPlayer" ADD CONSTRAINT "BlockedPlayer_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
