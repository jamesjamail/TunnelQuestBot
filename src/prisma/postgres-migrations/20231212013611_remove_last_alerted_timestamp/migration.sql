/*
  Warnings:

  - You are about to drop the column `lastAlertedTimestamp` on the `Watch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Watch" DROP COLUMN "lastAlertedTimestamp";
