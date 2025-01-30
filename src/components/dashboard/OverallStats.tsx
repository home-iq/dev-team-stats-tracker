import { Card } from "@/components/ui/card";
import { GitPullRequest, Code2, GitCommit } from "lucide-react";
import { contributorsData } from "@/data/contributors";

export const OverallStats = () => {
  const { overall } = contributorsData;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
      <Card className="p-2 md:p-4 glass-morphism">
        <div className="flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground truncate">Total Commits</p>
            <p className="text-lg md:text-2xl font-semibold text-gradient">{overall.totalCommits}</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4 glass-morphism">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-muted-foreground text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground truncate">Merged PRs</p>
            <p className="text-lg md:text-2xl font-semibold text-gradient">{overall.mergedPrs}</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4 glass-morphism">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground truncate">Lines Added</p>
            <p className="text-lg md:text-2xl font-semibold text-emerald-400">+{overall.linesAdded.toLocaleString()}</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4 glass-morphism">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground truncate">Lines Removed</p>
            <p className="text-lg md:text-2xl font-semibold text-red-400">-{overall.linesRemoved.toLocaleString()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}; 