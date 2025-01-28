/*
  Warnings:

  - You are about to drop the column `githubOrg` on the `Team` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[githubOrgId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Team" DROP COLUMN "githubOrg",
ADD COLUMN     "githubOrgId" BIGINT,
ADD COLUMN     "githubOrgName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_githubOrgId_key" ON "Team"("githubOrgId");
