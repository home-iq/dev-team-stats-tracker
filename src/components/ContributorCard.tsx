import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit, GitPullRequest, Star, Code2 } from "lucide-react";
import { motion } from "framer-motion";

interface ContributorCardProps {
  contributor: {
    login: string;
    avatar_url: string;
    totalCommits: number;
    totalPrs: number;
    activeRepositories: string[];
    linesOfCode: number;
    contributionScore: number;
    rank: number;
  };
  onClick: () => void;
}

export const ContributorCard = ({ contributor, onClick }: ContributorCardProps) => {
  const truncatedLogin = contributor.login.length > 14 
    ? `${contributor.login.slice(0, 14)}...` 
    : contributor.login;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card
        className="p-6 cursor-pointer transition-all duration-100 ease-out relative overflow-hidden group glass-morphism hover:brightness-90 hover:translate-y-[2px] h-full flex flex-col"
        onClick={onClick}
      >
        <div className="absolute top-4 right-4 z-10 bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border border-primary/20">
          #{contributor.rank}
        </div>
        
        <div className="flex items-start space-x-4 flex-1">
          <Avatar className="w-16 h-16 border-2 border-primary/20 shrink-0">
            <img src={contributor.avatar_url} alt={contributor.login} className="object-cover" />
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-2 text-gradient" title={contributor.login}>{truncatedLogin}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitCommit className="w-3 h-3" />
                {contributor.totalCommits} commits
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitPullRequest className="w-3 h-3" />
                {contributor.totalPrs} PRs
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Star className="w-3 h-3" />
                {contributor.activeRepositories.length} repos
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Code2 className="w-3 h-3" />
                {contributor.linesOfCode.toLocaleString()} lines
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="text-sm text-muted-foreground">
            Contribution Score
            <span className="float-right font-semibold text-foreground">
              {contributor.contributionScore}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};