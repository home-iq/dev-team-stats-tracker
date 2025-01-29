-- AlterTable
ALTER TABLE "PullRequest" ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PullRequest_openedAt_idx" ON "PullRequest"("openedAt");
