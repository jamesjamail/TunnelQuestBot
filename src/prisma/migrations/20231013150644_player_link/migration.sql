-- CreateTable
CREATE TABLE "PlayerLink" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "server" "Server",
    "player" VARCHAR(255),
    "linkCode" UUID,
    "linkCodeExpiry" TIMESTAMP(3),

    CONSTRAINT "PlayerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerLink_server_player_idx" ON "PlayerLink"("server", "player");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLink_server_player_key" ON "PlayerLink"("server", "player");

-- AddForeignKey
ALTER TABLE "PlayerLink" ADD CONSTRAINT "PlayerLink_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
