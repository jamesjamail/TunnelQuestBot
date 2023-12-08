-- DropForeignKey
ALTER TABLE "BlockedPlayerByWatch" DROP CONSTRAINT "BlockedPlayerByWatch_watchId_fkey";

-- AddForeignKey
ALTER TABLE "BlockedPlayerByWatch" ADD CONSTRAINT "BlockedPlayerByWatch_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
