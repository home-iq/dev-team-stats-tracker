-- AlterTable
ALTER TABLE "Commit" ADD COLUMN     "authoredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Commit_authoredAt_idx" ON "Commit"("authoredAt");
