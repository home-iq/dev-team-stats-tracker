-- CreateIndex
CREATE INDEX "Commit_githubCommitId_idx" ON "Commit"("githubCommitId");

-- CreateIndex
CREATE INDEX "Contributor_githubUserId_idx" ON "Contributor"("githubUserId");

-- CreateIndex
CREATE INDEX "Contributor_githubLogin_idx" ON "Contributor"("githubLogin");

-- CreateIndex
CREATE INDEX "PullRequest_githubPrId_idx" ON "PullRequest"("githubPrId");

-- CreateIndex
CREATE INDEX "Repo_githubRepoId_idx" ON "Repo"("githubRepoId");

-- CreateIndex
CREATE INDEX "Team_githubOrgId_idx" ON "Team"("githubOrgId");

-- CreateIndex
CREATE INDEX "Team_githubOrgName_idx" ON "Team"("githubOrgName");
