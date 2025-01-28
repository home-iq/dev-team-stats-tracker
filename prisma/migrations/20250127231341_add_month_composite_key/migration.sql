/*
  Warnings:

  - A unique constraint covering the columns `[teamId,date]` on the table `Month` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Month_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Month_teamId_date_key" ON "Month"("teamId", "date");
